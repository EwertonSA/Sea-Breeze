const path=require('path');
const {pathToFileURL}=require('url');
const {chromium}=require('playwright');

jest.setTimeout(60000);

describe('coastline framing',()=>{
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

  test('keeps landward and seaward coastline edges inside the canvas',async()=>{
    await page.waitForFunction(()=>window.__glbLoaded&&window.__islandMeshes&&window.__islandMeshes[0]&&window.camera&&window.THREE,{timeout:30000});

    const framing=await page.evaluate(()=>{
      const terrain=window.__islandMeshes[0],position=terrain.geometry.getAttribute('position');
      terrain.updateWorldMatrix(true,false);window.camera.updateMatrixWorld(true);window.camera.updateProjectionMatrix();
      const canvas=document.querySelector('canvas'),canvasRect=canvas.getBoundingClientRect(),point=new window.THREE.Vector3();
      const screenXValues=[],screenYValues=[];
      for(let i=0;i<position.count;i++){
        point.fromBufferAttribute(position,i);terrain.localToWorld(point);point.project(window.camera);
        screenXValues.push((point.x+1)*0.5*canvasRect.width);
        screenYValues.push((1-point.y)*0.5*canvasRect.height);
      }
      const minX=Math.min(...screenXValues),maxX=Math.max(...screenXValues);
      const landwardThreshold=minX+(maxX-minX)*0.1,seawardThreshold=maxX-(maxX-minX)*0.1;
      const landwardInside=[],seawardInside=[];
      for(let i=0;i<screenXValues.length;i++){
        const x=screenXValues[i],y=screenYValues[i];
        const inside=x>=canvasRect.left&&x<=canvasRect.right&&y>=canvasRect.top&&y<=canvasRect.bottom;
        if(x<=landwardThreshold)landwardInside.push(inside);
        if(x>=seawardThreshold)seawardInside.push(inside);
      }
      const ratio=values=>values.filter(Boolean).length/values.length;
      return {
        landwardCount:landwardInside.length,
        seawardCount:seawardInside.length,
        landwardRatio:ratio(landwardInside),
        seawardRatio:ratio(seawardInside),
        extremesInside:landwardInside[0]&&landwardInside[landwardInside.length-1]&&seawardInside[0]&&seawardInside[seawardInside.length-1]
      };
    });

    expect(framing.landwardCount).toBeGreaterThan(0);
    expect(framing.seawardCount).toBeGreaterThan(0);
    expect(framing.landwardRatio).toBeGreaterThanOrEqual(0.9);
    expect(framing.seawardRatio).toBeGreaterThanOrEqual(0.9);
    expect(consoleErrors).toEqual([]);
  });
});
