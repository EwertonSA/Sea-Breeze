const path=require('path');
const {pathToFileURL}=require('url');
const {chromium}=require('playwright');

jest.setTimeout(90000);

describe('camera pointer rotation',()=>{
  let browser;
  let page;
  const consoleErrors=[];

  beforeAll(async()=>{
    jest.setTimeout(90000);
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

  test('rotates the camera when the canvas is dragged',async()=>{
    await page.waitForFunction(()=>window.__glbLoaded&&window.camera&&window.controls&&window.renderer&&window.renderer.domElement,{timeout:90000});

    await page.evaluate(()=>{
      window.controls.autoRotate=false;
      window.controls.update();
    });
    const initial=await page.evaluate(()=>({
      x:window.camera.quaternion.x,y:window.camera.quaternion.y,
      z:window.camera.quaternion.z,w:window.camera.quaternion.w
    }));
    const bounds=await page.evaluate(()=>window.renderer.domElement.getBoundingClientRect());
    const startX=bounds.left+bounds.width*0.5,startY=bounds.top+bounds.height*0.5;
    await page.mouse.move(startX,startY);
    await page.mouse.down();
    await page.mouse.move(startX+30,startY+10);
    await page.mouse.up();
    const final=await page.evaluate(()=>{
      window.controls.update();
      return {
        x:window.camera.quaternion.x,y:window.camera.quaternion.y,
        z:window.camera.quaternion.z,w:window.camera.quaternion.w
      };
    });
    const quaternionDelta=Math.hypot(final.x-initial.x,final.y-initial.y,final.z-initial.z,final.w-initial.w);

    expect(quaternionDelta).toBeGreaterThan(0.0001);
    expect(consoleErrors).toEqual([]);
  });
});
