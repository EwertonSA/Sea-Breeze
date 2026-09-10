const path=require('path');
const {pathToFileURL}=require('url');
const {chromium}=require('playwright');

jest.setTimeout(60000);

describe('cloud upper/underside brightness',()=>{
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

  test('cloud upper surfaces are brighter than undersides',async()=>{
    await page.waitForFunction(()=>window.clusters&&window.updateClouds&&window.THREE,{timeout:30000});

    const brightness=await page.evaluate(()=>{
      window.updateClouds(1.0,1.0,0);
      const luma=color=>0.2126*color.r+0.7152*color.g+0.0722*color.b;
      let brighterUpper=0,totalClusters=0;
      for(const cluster of window.clusters){
        const sprites=cluster.sprites;
        if(sprites.length<6)continue;
        totalClusters++;
        const upperBrightness=Math.max(luma(sprites[3].material.color),luma(sprites[4].material.color));
        const undersideBrightness=luma(sprites[5].material.color);
        if(upperBrightness>undersideBrightness)brighterUpper++;
      }
      return {brighterUpper,totalClusters};
    });

    expect(brightness.totalClusters).toBeGreaterThan(0);
    expect(brightness.brighterUpper/brightness.totalClusters).toBeGreaterThanOrEqual(0.7);
    expect(consoleErrors).toEqual([]);
  });
});
