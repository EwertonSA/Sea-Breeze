const path=require('path');
const {pathToFileURL}=require('url');
const {chromium}=require('playwright');

jest.setTimeout(60000);

describe('wind arrow color contrast',()=>{
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

  test('wind arrows contrast with both land and sea surfaces',async()=>{
    await page.waitForFunction(()=>window.__glbLoaded&&window.__coastline&&window.sea&&window.arrows&&window.THREE&&window.arrows.instanceColor,{timeout:30000});

    const contrast=await page.evaluate(()=>{
      const arrows=window.arrows,terrain=window.__coastline,sea=window.sea;
      const matrix=new window.THREE.Matrix4(),worldPosition=new window.THREE.Vector3(),arrowColor=new window.THREE.Color(),vertex=new window.THREE.Vector3();
      const terrainPosition=terrain.geometry.getAttribute('position'),terrainColors=terrain.geometry.getAttribute('color');
      terrain.updateWorldMatrix(true,false);sea.updateWorldMatrix(true,false);
      const step=Math.max(1,Math.floor(terrainPosition.count/32));
      const landSamples=[];
      for(let i=0;i<terrainPosition.count;i+=step){
        vertex.fromBufferAttribute(terrainPosition,i);terrain.localToWorld(vertex);
        const color=terrainColors?[terrainColors.getX(i),terrainColors.getY(i),terrainColors.getZ(i)]:[0.5,0.7,0.4];
        landSamples.push({x:vertex.x,z:vertex.z,color});
      }
      const seaMaterial=sea.material;
      const seaColor=seaMaterial&&seaMaterial.color?seaMaterial.color.clone():new window.THREE.Color(0x166f8c);
      const luma=color=>0.2126*color[0]+0.7152*color[1]+0.0722*color[2];
      const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
      const landResults=[],seaResults=[];
      for(let i=0;i<arrows.count;i++){
        arrows.getMatrixAt(i,matrix);worldPosition.setFromMatrixPosition(matrix).applyMatrix4(arrows.matrixWorld);
        arrows.getColorAt(i,arrowColor);
        const arrow=[arrowColor.r,arrowColor.g,arrowColor.b];
        let nearest=null,best=Infinity;
        for(const sample of landSamples){
          const delta=(sample.x-worldPosition.x)**2+(sample.z-worldPosition.z)**2;
          if(delta<best){best=delta;nearest=sample}
        }
        if(best<100){
          landResults.push({rgbDistance:distance(arrow,nearest.color),luminanceDistance:Math.abs(luma(arrow)-luma(nearest.color))});
        }else{
          seaResults.push({rgbDistance:distance(arrow,[seaColor.r,seaColor.g,seaColor.b]),luminanceDistance:Math.abs(luma(arrow)-luma([seaColor.r,seaColor.g,seaColor.b]))});
        }
      }
      const pass=results=>results.filter(result=>result.rgbDistance>=0.10).length/results.length;
      return {
        landCount:landResults.length,
        seaCount:seaResults.length,
        landPassRatio:pass(landResults),
        seaPassRatio:pass(seaResults),
        landAverageLuminanceContrast:landResults.reduce((sum,result)=>sum+result.luminanceDistance,0)/landResults.length,
        seaAverageLuminanceContrast:seaResults.reduce((sum,result)=>sum+result.luminanceDistance,0)/seaResults.length
      };
    });

    expect(contrast.landCount).toBeGreaterThan(0);
    expect(contrast.seaCount).toBeGreaterThan(0);
    expect(contrast.landPassRatio).toBeGreaterThanOrEqual(0.7);
    expect(contrast.seaPassRatio).toBeGreaterThanOrEqual(0.7);
    expect(consoleErrors).toEqual([]);
  });
});
