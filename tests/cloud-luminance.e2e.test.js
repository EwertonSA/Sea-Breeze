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

  test('clouds render lighter than the sea directly below',async()=>{
    await page.waitForFunction(()=>
      Array.isArray(window.clusters)&&window.clusters.length>0&&
      typeof window.updateClouds==='function'&&window.sea&&window.THREE&&
      window.renderer&&window.camera,
      {timeout:30000}
    );

    const luminance=await page.evaluate(()=>{
      window.updateClouds(1.0,1.0,0);
      window.renderer.render(window.__threeScene,window.camera);
      const gl=window.renderer.getContext(),canvas=window.renderer.domElement;
      const canvasRect=canvas.getBoundingClientRect();
      const point=new window.THREE.Vector3();
      const luma=rgb=>0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2];
      const readPixel=(screenX,screenY)=>{
        const pixel=new Uint8Array(4);
        gl.readPixels(Math.round(screenX),canvas.height-Math.round(screenY),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
        return [pixel[0]/255,pixel[1]/255,pixel[2]/255];
      };
      const sprites=window.clusters.flatMap(cluster=>cluster.sprites).filter(sprite=>sprite.visible&&sprite.material.opacity>0);
      let lighterCount=0,sampledCount=0,elevatedCount=0;
      for(const sprite of sprites){
        point.copy(sprite.position).project(window.camera);
        const cloudX=(point.x+1)*0.5*canvas.width,cloudY=(1-point.y)*0.5*canvas.height;
        point.set(sprite.position.x,window.sea.position.y,sprite.position.z).project(window.camera);
        const seaX=(point.x+1)*0.5*canvas.width,seaY=(1-point.y)*0.5*canvas.height;
        if(cloudX<0||cloudX>=canvas.width||cloudY<0||cloudY>=canvas.height||seaX<0||seaX>=canvas.width||seaY<0||seaY>=canvas.height)continue;
        sampledCount++;
        const cloudPixel=readPixel(cloudX,cloudY),seaPixel=readPixel(seaX,seaY);
        if(luma(cloudPixel)>luma(seaPixel))lighterCount++;
        if(sprite.position.y>0)elevatedCount++;
      }
      return {
        visibleClouds:sprites.length,
        sampledCount,
        lighterCount,
        majorityLighter:lighterCount/sampledCount>=0.5,
        elevatedClouds:elevatedCount
      };
    });

    expect(luminance.visibleClouds).toBeGreaterThan(0);
    expect(luminance.sampledCount).toBeGreaterThan(0);
    expect(luminance.majorityLighter).toBe(true);
    expect(luminance.elevatedClouds).toBeGreaterThan(0);
    expect(consoleErrors).toEqual([]);
  });
});
