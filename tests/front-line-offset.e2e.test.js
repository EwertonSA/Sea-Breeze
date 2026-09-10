const path=require('path');
const {pathToFileURL}=require('url');
const {chromium}=require('playwright');

jest.setTimeout(60000);

describe('front line offset from coastline',()=>{
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

  test('front markers are offset from the coastline',async()=>{
    await page.waitForFunction(()=>window.__glbLoaded&&window.__coastline&&window.__frontLineMeshes&&window.THREE,{timeout:30000});

    const offset=await page.evaluate(()=>{
      const terrain=window.__coastline,position=terrain.geometry.getAttribute('position');
      terrain.updateWorldMatrix(true,false);
      const vertex=new window.THREE.Vector3(),point=new window.THREE.Vector3();
      const step=Math.max(1,Math.floor(position.count/32));
      const coastSamples=[];
      for(let i=0;i<position.count;i+=step){
        vertex.fromBufferAttribute(position,i);terrain.localToWorld(vertex);
        coastSamples.push({x:vertex.x,z:vertex.z});
      }
      const frontMeshes=window.__frontLineMeshes.filter(mesh=>mesh&&mesh.visible);
      const frontPositions=[];
      for(const mesh of frontMeshes){
        const frontPosition=mesh.geometry.getAttribute('position');
        if(!frontPosition)continue;
        mesh.updateWorldMatrix(true,false);
        for(let i=0;i<frontPosition.count;i+=Math.max(1,Math.floor(frontPosition.count/8))){
          point.fromBufferAttribute(frontPosition,i);mesh.localToWorld(point);
          frontPositions.push({x:point.x,z:point.z});
        }
      }
      let minDistance=Infinity,maxDistance=0,totalDistance=0;
      for(const front of frontPositions){
        let best=Infinity;
        for(const coast of coastSamples){
          const delta=(front.x-coast.x)**2+(front.z-coast.z)**2;
          if(delta<best)best=delta;
        }
        best=Math.sqrt(best);
        minDistance=Math.min(minDistance,best);maxDistance=Math.max(maxDistance,best);totalDistance+=best;
      }
      const averageDistance=totalDistance/frontPositions.length;
      return {
        frontMeshCount:frontMeshes.length,
        frontPointCount:frontPositions.length,
        minDistance,
        maxDistance,
        averageDistance
      };
    });

    expect(offset.frontMeshCount).toBeGreaterThan(0);
    expect(offset.frontPointCount).toBeGreaterThan(0);
    expect(offset.minDistance).toBeGreaterThan(0.5);
    expect(offset.averageDistance).toBeGreaterThan(1.0);
    expect(consoleErrors).toEqual([]);
  });
});
