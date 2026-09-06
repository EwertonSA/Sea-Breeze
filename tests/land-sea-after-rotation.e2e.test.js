const path=require('path');
const {pathToFileURL}=require('url');
const {chromium}=require('playwright');

jest.setTimeout(60000);

describe('land and sea after camera rotation',()=>{
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

  test('keeps distinguishable land and sea meshes after dragging',async()=>{
    await page.waitForFunction(()=>window.camera&&window.controls&&window.__coastline&&window.sea&&window.THREE,{timeout:30000});
    const canvas=page.locator('#scene canvas');
    await canvas.waitFor({state:'attached',timeout:15000});
    expect(await canvas.isVisible()).toBe(true);

    await page.evaluate(()=>{
      window.controls.autoRotate=false;
      window.camera.position.set(140,80,110);
      window.controls.target.set(-14,3,0);
      window.controls.update();
    });
    const initial=await page.evaluate(()=>({
      x:window.camera.quaternion.x,y:window.camera.quaternion.y,
      z:window.camera.quaternion.z,w:window.camera.quaternion.w
    }));
    const bounds=await canvas.boundingBox();
    expect(bounds).not.toBeNull();
    const startX=bounds.x+bounds.width*0.5,startY=bounds.y+bounds.height*0.5;
    await page.mouse.move(startX,startY);
    await page.mouse.down();
    await page.mouse.move(startX+170,startY+35);
    await page.mouse.up();
    const result=await page.evaluate((before)=>{
      window.controls.update();
      const after=window.camera.quaternion;
      const terrainMaterial=window.__coastline.material,seaMaterial=window.sea.material;
      return {
        rotated:Math.hypot(after.x-before.x,after.y-before.y,after.z-before.z,after.w-before.w)>0.0001,
        landVisible:window.__coastline.visible===true,
        seaVisible:window.sea.visible===true,
        landTexture:Boolean(terrainMaterial.map&&terrainMaterial.map.isTexture),
        landNormalMap:Boolean(terrainMaterial.normalMap&&terrainMaterial.normalMap.isTexture),
        seaUniforms:Boolean(seaMaterial.uniforms&&seaMaterial.uniforms.uDeep&&seaMaterial.uniforms.uShallow&&seaMaterial.uniforms.uOceanMap),
        landIsMesh:window.__coastline instanceof window.THREE.Mesh,
        seaIsMesh:window.sea instanceof window.THREE.Mesh
      };
    },initial);

    expect(result.rotated).toBe(true);
    expect(result.landIsMesh).toBe(true);
    expect(result.seaIsMesh).toBe(true);
    expect(result.landVisible).toBe(true);
    expect(result.seaVisible).toBe(true);
    expect(result.landTexture).toBe(true);
    expect(result.landNormalMap).toBe(true);
    expect(result.seaUniforms).toBe(true);
    expect(consoleErrors).toEqual([]);
  });
});
