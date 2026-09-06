const path=require('path');
const {pathToFileURL}=require('url');
const {chromium}=require('playwright');

jest.setTimeout(60000);

describe('opening-view temperature controls',()=>{
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

  test('shows land and sea temperature controls with named labels',async()=>{
    const landInput=page.locator('#landRange');
    const seaInput=page.locator('#seaRange');
    const landLabel=page.getByText('Land temperature',{exact:true});
    const seaLabel=page.getByText('Sea temperature',{exact:true});

    await landInput.waitFor({state:'attached',timeout:15000});
    await seaInput.waitFor({state:'attached',timeout:15000});
    await landLabel.waitFor({state:'attached',timeout:15000});
    await seaLabel.waitFor({state:'attached',timeout:15000});

    expect(await landInput.isVisible()).toBe(true);
    expect(await landLabel.isVisible()).toBe(true);
    expect(await seaInput.isVisible()).toBe(true);
    expect(await seaLabel.isVisible()).toBe(true);
  });
});
