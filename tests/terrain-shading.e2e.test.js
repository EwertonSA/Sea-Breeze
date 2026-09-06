const path=require('path');
const {pathToFileURL}=require('url');
const {chromium}=require('playwright');

jest.setTimeout(60000);

describe('terrain directional shading',()=>{
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

  test('has slope/elevation variation with directional lighting',async()=>{
    await page.waitForFunction(()=>window.__glbLoaded&&window.__coastline&&window.dirLight&&window.hemi&&window.THREE,{timeout:30000});

    const shading=await page.evaluate(()=>{
      const terrain=window.__coastline;
      const geometry=terrain.geometry;
      const position=geometry.getAttribute('position');
      terrain.updateWorldMatrix(true,false);
      const vertex=new window.THREE.Vector3();
      let minHeight=Infinity,maxHeight=-Infinity;
      const heights=[];
      for(let i=0;i<position.count;i++){
        vertex.fromBufferAttribute(position,i);terrain.localToWorld(vertex);
        minHeight=Math.min(minHeight,vertex.y);maxHeight=Math.max(maxHeight,vertex.y);
        heights.push(vertex.y);
      }
      heights.sort((a,b)=>a-b);
      const p25=heights[Math.floor(heights.length*0.25)],p75=heights[Math.floor(heights.length*0.75)];
      let directionalLightInScene=false,hemisphereLightInScene=false;
      window.__threeScene.traverse(object=>{
        if(object===window.dirLight)directionalLightInScene=true;
        if(object===window.hemi)hemisphereLightInScene=true;
      });
      return {
        isMesh:terrain instanceof window.THREE.Mesh,
        isImportedGLB:window.__glbRoot&&window.__glbLoaded,
        elevationRange:maxHeight-minHeight,
        interquartileRange:p75-p25,
        hasDirectionalLight:window.dirLight instanceof window.THREE.DirectionalLight&&window.dirLight.intensity>0&&directionalLightInScene,
        hasHemisphereLight:window.hemi instanceof window.THREE.HemisphereLight&&hemisphereLightInScene
      };
    });

    expect(shading.isMesh).toBe(true);
    expect(shading.isImportedGLB).toBe(true);
    expect(shading.elevationRange).toBeGreaterThan(0.5);
    expect(shading.interquartileRange).toBeGreaterThan(0.2);
    expect(shading.hasDirectionalLight).toBe(true);
    expect(shading.hasHemisphereLight).toBe(true);
    expect(consoleErrors).toEqual([]);
  });
});
