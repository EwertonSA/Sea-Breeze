const path=require('path');
const {pathToFileURL}=require('url');
const {chromium}=require('playwright');

jest.setTimeout(60000);

describe('sea specular sheen',()=>{
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

  test('sea is smooth and specular while land is rough and non-metallic',async()=>{
    await page.waitForFunction(()=>window.__glbLoaded&&window.sea&&window.__coastline&&window.THREE,{timeout:30000});

    const materials=await page.evaluate(()=>{
      const seaMaterial=window.sea.material;
      const landMaterial=window.__coastline.material;
      return {
        seaIsStandard:seaMaterial instanceof window.THREE.MeshStandardMaterial,
        seaRoughness:seaMaterial.roughness,
        seaMetalness:seaMaterial.metalness,
        landIsStandard:landMaterial instanceof window.THREE.MeshStandardMaterial,
        landRoughness:landMaterial.roughness,
        landMetalness:landMaterial.metalness
      };
    });

    expect(materials.seaIsStandard).toBe(true);
    expect(materials.seaRoughness).toBeLessThanOrEqual(0.5);
    expect(materials.seaMetalness).toBeLessThanOrEqual(0.1);
    expect(materials.landIsStandard).toBe(true);
    expect(materials.landRoughness).toBeGreaterThanOrEqual(0.6);
    expect(materials.landMetalness).toBe(0);
    expect(consoleErrors).toEqual([]);
  });
});
