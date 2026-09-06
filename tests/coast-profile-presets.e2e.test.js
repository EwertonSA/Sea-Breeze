const path=require('path');
const {pathToFileURL}=require('url');
const {chromium}=require('playwright');

jest.setTimeout(60000);

describe('coast profile presets',()=>{
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

  test('shows three named coast profile presets',async()=>{
    const presets={
      straight:page.locator('[data-preset="straight"]'),
      bay:page.locator('[data-preset="bay"]'),
      cape:page.locator('[data-preset="cape"]')
    };

    for(const preset of Object.values(presets)){
      await preset.waitFor({state:'attached',timeout:15000});
      expect(await preset.isVisible()).toBe(true);
    }

    expect(await presets.straight.textContent()).toContain('Straight');
    expect(await presets.bay.textContent()).toContain('Bay');
    expect(await presets.cape.textContent()).toContain('Cape');
    expect(consoleErrors).toEqual([]);
  });
});
