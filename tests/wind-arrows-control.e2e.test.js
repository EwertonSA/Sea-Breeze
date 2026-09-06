const path=require('path');
const {pathToFileURL}=require('url');
const {chromium}=require('playwright');

jest.setTimeout(60000);

describe('wind arrows control',()=>{
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

  test('shows a labeled wind arrows toggle',async()=>{
    const toggle=page.locator('#tglArrows');
    const label=page.getByText('Wind arrows',{exact:true});

    await toggle.waitFor({state:'attached',timeout:15000});
    await label.waitFor({state:'attached',timeout:15000});

    expect(await toggle.isVisible()).toBe(true);
    expect(await label.isVisible()).toBe(true);
    expect(await toggle.getAttribute('aria-label')).toEqual(expect.stringMatching(/wind arrows/i));
    expect(consoleErrors).toEqual([]);
  });
});
