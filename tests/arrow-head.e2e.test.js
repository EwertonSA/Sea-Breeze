const path=require('path');
const {pathToFileURL}=require('url');
const {chromium}=require('playwright');

jest.setTimeout(60000);

describe('wind arrow geometry',()=>{
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

  test('draws arrows with a distinguishable head',async()=>{
    await page.waitForFunction(()=>window.THREE&&window.arrows&&window.arrowGeo,{timeout:30000});

    const geometry=await page.evaluate(()=>{
      const position=window.arrowGeo.attributes.position;
      let minZ=Infinity,maxZ=-Infinity;
      for(let i=0;i<position.count;i++){
        const z=position.getZ(i);
        minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);
      }
      const length=maxZ-minZ,headStart=minZ+length*0.62;
      let shaftRadius=0,headRadius=0;
      for(let i=0;i<position.count;i++){
        const radius=Math.hypot(position.getX(i),position.getY(i));
        if(position.getZ(i)<=headStart)shaftRadius=Math.max(shaftRadius,radius);
        else headRadius=Math.max(headRadius,radius);
      }
      return {
        length,
        shaftRadius,
        headRadius,
        isInstancedMesh:window.arrows instanceof window.THREE.InstancedMesh
      };
    });

    expect(geometry.length).toBeGreaterThan(1.3);
    expect(geometry.headRadius).toBeGreaterThan(geometry.shaftRadius*2);
    expect(geometry.isInstancedMesh).toBe(true);
    expect(consoleErrors).toEqual([]);
  });
});
