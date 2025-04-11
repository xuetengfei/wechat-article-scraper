// scrape_batch.js
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');


const links = fs.readFileSync('links.txt', 'utf-8')
  .split('\n')
  .map(line => line.trim())
  .map(line => line.replaceAll("来源：",""))
  .filter(line => line.startsWith('https://mp.weixin.qq.com/s/'));

console.log('links')

;(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');

  for (const [index, url] of links.entries()) {
    try {
      console.log(`📥 [${index + 1}/${links.length}] 正在抓取：${url}`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

      const result = await page.evaluate(() => {
        const title = document.querySelector('#activity-name')?.innerText.trim();
        const author = document.querySelector('#js_name')?.innerText.trim();
        const contentNode = document.querySelector('#js_content');
        const content = contentNode ? contentNode.innerText.trim() : '';
        return { title, author, content };
      });

      const safeTitle = result.title.replace(/[\/\\:*?"<>|]/g, '_'); // 替换非法文件名字符
      // const mdContent = `# ${result.title}\n\n**作者**：${result.author}\n\n---\n\n${result.content}`;
      // const mdContent = `# ${result.title}\n\n[${result.title}](${url})\n\n**作者**：${result.author}\n\n---\n\n${result.content}`;
      const mdContent = `\n\n[${result.title}](${url})\n\n**作者**：${result.author}\n\n---\n\n${result.content}`;
      const outputPath = path.join('articles', `${safeTitle}.md`);

      fs.mkdirSync('articles', { recursive: true });
      fs.writeFileSync(outputPath, mdContent);

      console.log(`✅ 保存成功：${outputPath}`);
    } catch (err) {
      console.error(`❌ 抓取失败：${url}`);
      console.error(err.message);
    }
  }

  await browser.close();
})();

