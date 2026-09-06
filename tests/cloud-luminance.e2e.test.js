const path=require('path');
const {pathToFileURL}=require('url');
const {chromium}=require('playwright');

jest.setTimeout(60000);

describe('cloud and sea luminance',()=>{
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

  test('renders clouds lighter than the sea and above the terrain',async()=>{
    await page.waitForFunction(()=>
      Array.isArray(window.clusters)&&window.clusters.length>0&&
      typeof window.coastFn==='function'&&typeof window.heightAt==='function'&&
      typeof window.updateClouds==='function'&&window.sea&&window.THREE,
      {timeout:30000}
    );

    const luminance=await page.evaluate(()=>{
      window.updateClouds(1.0,1.0,0);
      const luma=(color)=>0.2126*color.r+0.7152*color.g+0.0722*color.b;
      const uniforms=window.sea.material.uniforms;
      const seaLuminance=Math.max(luma(uniforms.uDeep.value),luma(uniforms.uShallow.value),luma(uniforms.uSky.value));
      const sprites=window.clusters.flatMap(cluster=>cluster.sprites).filter(sprite=>sprite.visible&&sprite.material.opacity>0);
      const cloudLuminances=sprites.map(sprite=>luma(sprite.material.color));
      const elevations=sprites.map(sprite=>sprite.position.y-window.heightAt(sprite.position.x,sprite.position.z));
      return {
        visibleClouds:sprites.length,
        brightestSea:seaLuminance,
        dimmestCloud:Math.min(...cloudLuminances),
        allCloudsLighter:cloudLuminances.every(value=>value>seaLuminance),
        elevatedClouds:elevations.filter(value=>value>0).length
      };
    });

    expect(luminance.visibleClouds).toBeGreaterThan(0);
    expect(luminance.allCloudsLighter).toBe(true);
    expect(luminance.dimmestCloud).toBeGreaterThan(luminance.brightestSea);
    expect(luminance.elevatedClouds).toBeGreaterThan(0);
    expect(consoleErrors).toEqual([]);
  });
});
