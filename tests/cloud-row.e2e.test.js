const path=require('path');
const {pathToFileURL}=require('url');
const {chromium}=require('playwright');

jest.setTimeout(60000);

describe('coastal cloud row',()=>{
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

  test('cloud forms follow the land and sea boundary',async()=>{
    await page.waitForFunction(()=>
      Array.isArray(window.clusters)&&window.clusters.length>0&&
      typeof window.coastFn==='function'&&typeof window.updateClouds==='function'&&
      window.clusters.every(cluster=>cluster.sprites&&cluster.sprites.length>0),
      {timeout:30000}
    );

    const geometry=await page.evaluate(()=>{
      const penW=1.0;
      window.updateClouds(1.0,0.5,0);
      const distances=window.clusters.map(cluster=>{
        const sprite=cluster.sprites[0];
        return Math.abs(sprite.position.x-(window.coastFn(cluster.z)-penW));
      });
      const zValues=window.clusters.map(cluster=>cluster.z);
      return {
        maxDistance:Math.max(...distances),
        averageDistance:distances.reduce((sum,distance)=>sum+distance,0)/distances.length,
        zSpan:Math.max(...zValues)-Math.min(...zValues)
      };
    });

    expect(geometry.maxDistance).toBeLessThanOrEqual(4.0);
    expect(geometry.averageDistance).toBeLessThanOrEqual(2.5);
    expect(geometry.zSpan).toBeGreaterThanOrEqual(100);
  });
});
