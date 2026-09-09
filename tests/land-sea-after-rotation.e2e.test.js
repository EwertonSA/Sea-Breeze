const path=require('path');
const {pathToFileURL}=require('url');
const {chromium}=require('playwright');

jest.setTimeout(90000);

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
    await page.waitForFunction(()=>window.__glbLoaded&&window.camera&&window.controls&&window.__coastline&&window.sea&&window.THREE,{timeout:30000});

    await page.evaluate(()=>{
      window.controls.autoRotate=false;
      window.camera.position.set(156,74,198);
      window.controls.target.set(-14,3,0);
      window.controls.update();
    });
    const initial=await page.evaluate(()=>({
      x:window.camera.quaternion.x,y:window.camera.quaternion.y,
      z:window.camera.quaternion.z,w:window.camera.quaternion.w
    }));
    await page.mouse.move(640,360);
    await page.mouse.down();
    await page.mouse.move(810,395);
    await page.mouse.up();
    const result=await page.evaluate((before)=>{
      window.controls.update();
      const after=window.camera.quaternion;
      let landInScene=false,seaInScene=false;
      window.__threeScene.traverse(object=>{
        if(object===window.__coastline)landInScene=true;
        if(object===window.sea)seaInScene=true;
      });
      return {
        rotated:Math.hypot(after.x-before.x,after.y-before.y,after.z-before.z,after.w-before.w)>0.0001,
        landVisible:window.__coastline.visible===true,
        seaVisible:window.sea.visible===true,
        landIsMesh:window.__coastline instanceof window.THREE.Mesh,
        seaIsMesh:window.sea instanceof window.THREE.Mesh,
        landInScene,
        seaInScene
      };
    },initial);

    expect(result.rotated).toBe(true);
    expect(result.landIsMesh).toBe(true);
    expect(result.seaIsMesh).toBe(true);
    expect(result.landVisible).toBe(true);
    expect(result.seaVisible).toBe(true);
    expect(result.landInScene).toBe(true);
    expect(result.seaInScene).toBe(true);
    expect(consoleErrors).toEqual([]);
  });
});
