const path=require('path');
const {pathToFileURL}=require('url');
const {chromium}=require('playwright');

jest.setTimeout(60000);

describe('water and adjacent land elevation',()=>{
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

  test('keeps the water surface below the adjacent GLB land surface',async()=>{
    await page.waitForFunction(()=>window.__glbLoaded&&window.__coastline&&window.sea&&window.THREE,{timeout:30000});

    const levels=await page.evaluate(()=>{
      const sea=window.sea,terrain=window.__coastline;
      terrain.updateWorldMatrix(true,false);sea.updateWorldMatrix(true,false);
      const vertex=new window.THREE.Vector3();
      let landSum=0,landCount=0,seaSum=0,seaCount=0;
      const landPosition=terrain.geometry.getAttribute('position');
      for(let i=0;i<landPosition.count;i++){
        vertex.fromBufferAttribute(landPosition,i);terrain.localToWorld(vertex);
        landSum+=vertex.y;landCount++;
      }
      const seaPosition=sea.geometry.getAttribute('position');
      for(let i=0;i<seaPosition.count;i++){
        vertex.fromBufferAttribute(seaPosition,i);sea.localToWorld(vertex);
        seaSum+=vertex.y;seaCount++;
      }
      const landAverage=landSum/landCount,seaAverage=seaSum/seaCount;
      return {
        seaIsMesh:sea instanceof window.THREE.Mesh,
        landIsMesh:terrain instanceof window.THREE.Mesh,
        isImportedGLB:window.__glbRoot&&window.__glbLoaded,
        landCount,
        seaCount,
        landAverage,
        seaAverage,
        landAboveWater:landAverage-seaAverage
      };
    });

    expect(levels.seaIsMesh).toBe(true);
    expect(levels.landIsMesh).toBe(true);
    expect(levels.isImportedGLB).toBe(true);
    expect(levels.landCount).toBeGreaterThan(0);
    expect(levels.seaCount).toBeGreaterThan(0);
    expect(levels.landAboveWater).toBeGreaterThanOrEqual(0.1);
    expect(consoleErrors).toEqual([]);
  });
});
