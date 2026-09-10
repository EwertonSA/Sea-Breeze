const path=require('path');
const {pathToFileURL}=require('url');
const {chromium}=require('playwright');

jest.setTimeout(15000);

describe('Three.js coastline rendering',()=>{
  let browser;
  let page;
  const consoleErrors=[];

  beforeAll(async()=>{
    jest.setTimeout(15000);
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
    await page.waitForFunction(()=>{
      const canvas=document.querySelector('canvas');
      return canvas&&canvas.width>0&&canvas.height>0&&window.__threeScene&&window.__coastline;
    },{timeout:15000});
  });

  afterAll(async()=>{
    if(browser)await browser.close();
  });

  test('a visible 3D coastline strip renders',async()=>{
    const state=await page.evaluate(()=>{
      const canvas=document.querySelector('canvas');
      const gl=canvas.getContext('webgl2')||canvas.getContext('webgl')||canvas.getContext('experimental-webgl');
      let belongsToScene=false;
      window.__threeScene.traverse(object=>{
        if(object===window.__coastline)belongsToScene=true;
      });
      const position=window.__coastline.geometry&&window.__coastline.geometry.getAttribute('position');
      return {
        hasDrawingBuffer:Boolean(gl&&gl.drawingBufferWidth>0&&gl.drawingBufferHeight>0),
        isMesh:window.__coastline.isMesh===true,
        visible:window.__coastline.visible===true,
        belongsToScene,
        vertexCount:position?position.count:0
      };
    });

    expect(state.hasDrawingBuffer).toBe(true);
    expect(state.isMesh).toBe(true);
    expect(state.visible).toBe(true);
    expect(state.belongsToScene).toBe(true);
    expect(state.vertexCount).toBeGreaterThan(50);
  });
});
