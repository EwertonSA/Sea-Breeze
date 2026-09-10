const path=require('path');
const {pathToFileURL}=require('url');
const {chromium}=require('playwright');

jest.setTimeout(60000);

describe('coastline overlay visibility',()=>{
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

  test('keeps the coastline outside the control panel overlay',async()=>{
    await page.locator('#panel').waitFor({state:'attached',timeout:15000});
    await page.waitForFunction(()=>window.__glbLoaded&&window.__islandMeshes&&window.__islandMeshes.length>0&&window.camera&&window.THREE,{timeout:30000});

    const visibility=await page.evaluate(()=>{
      const panel=document.querySelector('#panel'),panelRect=panel.getBoundingClientRect();
      const islandMeshes=window.__islandMeshes.slice(0,4);
      window.camera.updateMatrixWorld(true);window.camera.updateProjectionMatrix();
      const point=new window.THREE.Vector3();
      let coastlinePoints=0,outsidePanel=0;
      for(const terrain of islandMeshes){
        terrain.updateWorldMatrix(true,false);
        const position=terrain.geometry.getAttribute('position');
        for(let i=0;i<position.count;i++){
          point.fromBufferAttribute(position,i);terrain.localToWorld(point);point.project(window.camera);
          const screenX=(point.x+1)*0.5*innerWidth,screenY=(1-point.y)*0.5*innerHeight;
          coastlinePoints++;
          if(screenX<panelRect.left||screenX>panelRect.right||screenY<panelRect.top||screenY>panelRect.bottom)outsidePanel++;
        }
      }
      return {
        coastlinePoints,
        outsidePanel,
        visibleRatio:outsidePanel/coastlinePoints,
        panel:{left:panelRect.left,top:panelRect.top,right:panelRect.right,bottom:panelRect.bottom}
      };
    });

    expect(visibility.coastlinePoints).toBeGreaterThan(0);
    expect(visibility.visibleRatio).toBeGreaterThanOrEqual(0.85);
    expect(consoleErrors).toEqual([]);
  });
});
