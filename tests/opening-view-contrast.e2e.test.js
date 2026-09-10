const path=require('path');
const {pathToFileURL}=require('url');
const {chromium}=require('playwright');

jest.setTimeout(60000);

describe('opening-view surface contrast',()=>{
  let browser;
  let page;
  const consoleErrors=[];

  beforeAll(async()=>{
    jest.setTimeout(60000);
    browser=await chromium.launch({
      headless:true,
      args:[
        '--allow-file-access-from-files',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });
    page=await browser.newPage({viewport:{width:1280,height:720}});
    page.on('console',message=>{
      if(message.type()==='error')consoleErrors.push(message.text());
    });
    await page.goto(pathToFileURL(path.resolve(__dirname,'..','index.html')).href,{waitUntil:'commit'});
  });

  afterAll(async()=>{
    if(browser)await browser.close();
  });

  test('renders distinguishable land, sea, and cloud colors',async()=>{
    await page.waitForFunction(()=>window.__glbLoaded&&window.__coastline&&window.sea&&window.clusters&&window.THREE,{timeout:30000});

    const colors=await page.evaluate(()=>{
      const renderer=window.renderer,scene=window.__threeScene,camera=window.camera;
      const terrain=window.__coastline,sea=window.sea,target=new window.THREE.WebGLRenderTarget(320,180);
      window.updateClouds(1.0,1.0,0);
      scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);camera.updateProjectionMatrix();
      const canvas=renderer.domElement,canvasRect=canvas.getBoundingClientRect(),point=new window.THREE.Vector3();
      const project=(object,localPoint)=>{
        point.copy(localPoint).applyMatrix4(object.matrixWorld).project(camera);
        return {x:Math.round((point.x+1)*0.5*target.width),y:Math.round((1-point.y)*0.5*target.height),z:point.z};
      };
      const terrainPosition=terrain.geometry.getAttribute('position'),landPoints=[],landStep=Math.max(1,Math.floor(terrainPosition.count/16));
      for(let i=0;i<terrainPosition.count&&landPoints.length<16;i+=landStep){
        point.fromBufferAttribute(terrainPosition,i);terrain.localToWorld(point);point.project(camera);
        landPoints.push({x:Math.round((point.x+1)*0.5*target.width),y:Math.round((1-point.y)*0.5*target.height),z:point.z});
      }
      const seaPosition=sea.geometry.getAttribute('position'),seaPoints=[],seaStep=Math.max(1,Math.floor(seaPosition.count/16));
      for(let i=0;i<seaPosition.count&&seaPoints.length<16;i+=seaStep){
        point.fromBufferAttribute(seaPosition,i);sea.localToWorld(point);point.project(camera);
        seaPoints.push({x:Math.round((point.x+1)*0.5*target.width),y:Math.round((1-point.y)*0.5*target.height),z:point.z});
      }
      const cloudPoints=window.clusters.map(cluster=>project(cluster.sprites[0],new window.THREE.Vector3(0,0,0)));
      const readSamples=points=>{
        const samples=[],pixel=new Uint8Array(4);
        for(const sample of points){
          if(sample.z<-1||sample.z>1||sample.x<0||sample.x>=target.width||sample.y<0||sample.y>=target.height)continue;
          renderer.readRenderTargetPixels(target,sample.x,target.height-1-sample.y,1,1,pixel);
          samples.push([pixel[0]/255,pixel[1]/255,pixel[2]/255]);
        }
        return samples;
      };
      renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.setRenderTarget(null);
      const averages={};
      for(const [name,points] of Object.entries({land:landPoints,sea:seaPoints,cloud:cloudPoints})){
        const samples=readSamples(points),average=samples.reduce((sum,color)=>sum.map((value,i)=>value+color[i]),[0,0,0]);
        averages[name]={sampleCount:samples.length,rgb:average.map(value=>value/samples.length)};
      }
      target.dispose();
      const luminance=color=>0.2126*color[0]+0.7152*color[1]+0.0722*color[2];
      const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
      return {
        land:averages.land,sea:averages.sea,cloud:averages.cloud,
        landSeaDistance:distance(averages.land.rgb,averages.sea.rgb),
        landCloudDistance:distance(averages.land.rgb,averages.cloud.rgb),
        seaCloudDistance:distance(averages.sea.rgb,averages.cloud.rgb),
        landLuminance:luminance(averages.land.rgb),seaLuminance:luminance(averages.sea.rgb),cloudLuminance:luminance(averages.cloud.rgb),
        canvasSize:{width:canvasRect.width,height:canvasRect.height}
      };
    });

    expect(colors.land.sampleCount).toBeGreaterThan(0);
    expect(colors.sea.sampleCount).toBeGreaterThan(0);
    expect(colors.cloud.sampleCount).toBeGreaterThan(0);
    expect(colors.landSeaDistance).toBeGreaterThan(0.05);
    expect(colors.landCloudDistance).toBeGreaterThan(0.05);
    expect(colors.seaCloudDistance).toBeGreaterThan(0.05);
    expect(consoleErrors).toEqual([]);
  });
});
