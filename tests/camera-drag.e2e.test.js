const path=require('path');
const {pathToFileURL}=require('url');
const {chromium}=require('playwright');

jest.setTimeout(60000);

describe('camera pointer rotation',()=>{
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

  test('rotates the camera when the canvas is dragged',async()=>{
    await page.waitForFunction(()=>window.camera&&window.controls&&window.renderer,{timeout:30000});
    const canvas=page.locator('canvas[data-engine*="three.js"]');
    await canvas.waitFor({state:'attached',timeout:15000});
    expect(await canvas.isVisible()).toBe(true);

    await page.evaluate(()=>{
      window.controls.autoRotate=false;
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
    await page.mouse.move(startX+180,startY+40);
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
