const path=require('path');
const {pathToFileURL}=require('url');
const {chromium}=require('playwright');

jest.setTimeout(60000);

describe('grouped control panel',()=>{
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

  test('groups controls inside a distinct background plate',async()=>{
    const panel=page.locator('#panel');
    const plate=panel.locator('.glass');

    await panel.waitFor({state:'attached',timeout:15000});
    await plate.waitFor({state:'attached',timeout:15000});

    expect(await panel.isVisible()).toBe(true);
    expect(await plate.isVisible()).toBe(true);

    const panelState=await page.evaluate(()=>{
      const root=document.querySelector('#panel');
      const backing=root&&root.querySelector('.glass');
      const style=backing?getComputedStyle(backing):null;
      const controlSelectors=['#landRange','#seaRange','#tglArrows'];
      const controlsNested=Boolean(root&&controlSelectors.every(selector=>{
        const control=document.querySelector(selector);
        return control&&root.contains(control);
      }));
      const hasDistinctPlate=Boolean(style&&(
        (style.backgroundColor&&style.backgroundColor!=='rgba(0, 0, 0, 0)'&&style.backgroundColor!=='transparent')||
        (style.backgroundImage&&style.backgroundImage!=='none')||
        (style.backdropFilter&&style.backdropFilter!=='none')
      ));
      return {
        backgroundColor:style&&style.backgroundColor,
        backgroundImage:style&&style.backgroundImage,
        backdropFilter:style&&style.backdropFilter,
        controlsNested,
        hasDistinctPlate
      };
    });

    expect(panelState.controlsNested).toBe(true);
    expect(panelState.hasDistinctPlate).toBe(true);
    expect(consoleErrors).toEqual([]);
  });
});
