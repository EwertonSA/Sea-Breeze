const path=require('path');
const {pathToFileURL}=require('url');
const {chromium}=require('playwright');

jest.setTimeout(60000);

describe('continuous land-water coastline',()=>{
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

  test('has continuous land and water regions on opposite sides of the coast',async()=>{
    await page.waitForFunction(()=>window.__coastline&&window.sea&&typeof window.coastFn==='function'&&typeof window.heightAt==='function'&&window.THREE,{timeout:30000});

    const coastline=await page.evaluate(()=>{
      const terrain=window.__coastline,position=terrain.geometry.getAttribute('position');
      let minZ=Infinity,maxZ=-Infinity;
      for(let i=0;i<position.count;i++){
        minZ=Math.min(minZ,position.getZ(i));maxZ=Math.max(maxZ,position.getZ(i));
      }
      const samples=[];
      for(let i=0;i<41;i++){
        const z=minZ+(maxZ-minZ)*i/40,coastX=window.coastFn(z),landX=coastX-0.5,seaX=coastX+0.5;
        const landHeight=window.heightAt(landX,z),seaHeight=window.heightAt(seaX,z);
        samples.push({z,coastX,landIsLand:landHeight>0,seaIsWater:seaHeight<=0,landHeight,seaHeight});
      }
      const coastSteps=samples.slice(1).map((sample,i)=>Math.abs(sample.coastX-samples[i].coastX));
      const classified=samples.filter(sample=>sample.landIsLand&&sample.seaIsWater).length/samples.length;
      return {
        landMesh:terrain instanceof window.THREE.Mesh,
        waterMesh:window.sea instanceof window.THREE.Mesh,
        sampleCount:samples.length,
        classifiedRatio:classified,
        maxCoastStep:Math.max(...coastSteps),
        elevationsSeparated:samples.every(sample=>sample.landHeight>sample.seaHeight)
      };
    });

    expect(coastline.landMesh).toBe(true);
    expect(coastline.waterMesh).toBe(true);
    expect(coastline.sampleCount).toBe(41);
    expect(coastline.classifiedRatio).toBeGreaterThanOrEqual(0.95);
    expect(coastline.maxCoastStep).toBeLessThanOrEqual(5);
    expect(coastline.elevationsSeparated).toBe(true);
    expect(consoleErrors).toEqual([]);
  });
});
