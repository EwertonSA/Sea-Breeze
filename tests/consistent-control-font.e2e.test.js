const path=require('path');
const {pathToFileURL}=require('url');
const {chromium}=require('playwright');

jest.setTimeout(60000);

describe('consistent control typography',()=>{
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

  test('uses one typeface for all panel control labels',async()=>{
    const panelBody=page.locator('#panelBody');
    await panelBody.waitFor({state:'attached',timeout:15000});
    expect(await panelBody.isVisible()).toBe(true);

    const typography=await page.evaluate(()=>{
      const elements=[...document.querySelectorAll('#panelBody .sec-label, #panelBody label, #panelBody button')];
      const families=elements.map(element=>getComputedStyle(element).fontFamily.trim().toLowerCase());
      return {elementCount:elements.length,uniqueFontFamilies:[...new Set(families)],families};
    });

    expect(typography.elementCount).toBeGreaterThan(0);
    expect(typography.uniqueFontFamilies.length).toBe(1);
    expect(consoleErrors).toEqual([]);
  });
});
