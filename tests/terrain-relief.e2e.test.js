const path=require('path');
const {pathToFileURL}=require('url');
const {chromium}=require('playwright');

jest.setTimeout(60000);

describe('terrain relief',()=>{
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

  test('has meaningful elevation variation in the GLB island asset',async()=>{
    await page.waitForFunction(()=>window.__glbLoaded&&window.__coastline&&window.__islandMeshes&&window.THREE,{timeout:30000});

    const relief=await page.evaluate(()=>{
      const terrain=window.__coastline,position=terrain.geometry.getAttribute('position');
      terrain.updateWorldMatrix(true,false);
      const vertex=new window.THREE.Vector3();
      let minHeight=Infinity,maxHeight=-Infinity,nearSum=0,nearCount=0,inlandSum=0,inlandCount=0;
      for(let i=0;i<position.count;i++){
        vertex.fromBufferAttribute(position,i);
        terrain.localToWorld(vertex);
        const y=vertex.y;
        minHeight=Math.min(minHeight,y);maxHeight=Math.max(maxHeight,y);
        if(y<1.0){nearSum+=y;nearCount++}
        else if(y>3.0){inlandSum+=y;inlandCount++}
      }
      const nearAverage=nearSum/nearCount,inlandAverage=inlandSum/inlandCount;
      return {
        isMesh:terrain instanceof window.THREE.Mesh,
        isImportedGLB:window.__glbRoot&&window.__glbLoaded,
        nearCount,
        inlandCount,
        nearAverage,
        inlandAverage,
        inlandRise:inlandAverage-nearAverage,
        elevationRange:maxHeight-minHeight
      };
    });

    expect(relief.isMesh).toBe(true);
    expect(relief.isImportedGLB).toBe(true);
    expect(relief.nearCount).toBeGreaterThan(0);
    expect(relief.inlandCount).toBeGreaterThan(0);
    expect(relief.inlandRise).toBeGreaterThanOrEqual(0.5);
    expect(relief.elevationRange).toBeGreaterThan(1.0);
    expect(consoleErrors).toEqual([]);
  });
});
