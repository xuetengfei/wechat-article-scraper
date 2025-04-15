// scrape_batch.js
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const links = [
  ...new Set(
    fs
      .readFileSync('links.txt', 'utf-8')
      .split('\n')
      .map(line => line.trim().replaceAll('来源：', '').replaceAll('URL: ', ''))
      .filter(
        line =>
          line.startsWith('https://mp.weixin.qq.com') ||
          line.startsWith('https://m.okjike.com/originalPosts'),
      ),
  ),
];

function writeLog({ status, title, url, filePath, error }) {
  const now = new Date().toISOString();
  const logLine =
    `[${now}] ${status.toUpperCase()} | ${title || '无标题'}\nURL: ${url}\n` +
    (filePath ? `Saved: ${filePath}\n` : '') +
    (error ? `Error: ${error}\n` : '') +
    `---\n`;
  fs.appendFileSync('log.txt', logLine);
}

function writeErrorLog({ status, title, url, filePath, error }) {
  const now = new Date().toISOString();
  const logLine =
    `[${now}] ${status.toUpperCase()} | ${title || '无标题'}\nURL: ${url}\n` +
    (filePath ? `Saved: ${filePath}\n` : '') +
    (error ? `Error: ${error}\n` : '') +
    `---\n`;
  fs.appendFileSync('error.txt', logLine);
}
// console.log('links');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  );

  for (const [index, url] of links.entries()) {
    try {
      console.log(`📥 [${index + 1}/${links.length}] 正在抓取：${url}`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

      let result = null;
      let folder = '';
      let safeTitle = null;
      let mdContent = null;

      if (url.includes('mp.weixin.qq.com')) {
        folder = 'articles';
        result = await page.evaluate(() => {
          const title = document
            .querySelector('#activity-name')
            ?.innerText.trim();
          const author = document.querySelector('#js_name')?.innerText.trim();
          const contentNode = document.querySelector('#js_content');
          const content = contentNode ? contentNode.innerText.trim() : '';
          if (!content) {
            throw new Error('抓取失败');
          }

          return { title, author, content };
        });
      }

      if (url.includes('m.okjike.com/originalPosts')) {
        folder = 'posts';
        result = await page.evaluate(() => {
          // 提取文章内容
          const _content =
            document.querySelector('#__next > div > div.post-page')
              ?.innerText || '';

          if (!_content) {
            throw new Error('抓取失败');
          }

          const content = _content
            .replaceAll('来自圈子', '---')
            .replaceAll('热门评论', '');

          // 提取标题、作者、时间等信息
          const title = document.title.replaceAll(' - 即刻App', '').trim();
          const author =
            document.querySelector(
              '#__next > div > div.post-page > div.post-wrap > div.wrap > div.info > div.title',
            )?.innerText || '无作者';

          const time =
            document.querySelector('.post-page .post-header .post-time')
              ?.innerText || '无时间';

          // 提取图片
          const images = Array.from(document.querySelectorAll('img'))
            .map(img => img.src)
            .filter(src => !src.includes('thumbnail/120x120')) // 删除缩略图
            .filter(src => !src.includes('data:image/svg+xml;base64')); // 删除空白图

          return { title, author, time, content, images };
        });
      }

      if (folder === 'posts') {
        // 清理标题，确保文件名合法
        safeTitle = result.title.slice(0, 50).replace(/[\/\\:*?"<>|]/g, '_');
        mdContent =
          `\n\n[${safeTitle}](${url})\n\n**作者**：${result.author}\n\n---\n\n${result.content}\n\n` +
          (result.images.length
            ? `**图片**：\n` +
              result.images.map(url => `![](${url})`).join('\n')
            : '');
      }
      if (folder === 'articles') {
        safeTitle = result.title.replace(/[\/\\:*?"<>|]/g, '_'); // 替换非法文件名字符
        mdContent = `\n\n[${result.title}](${url})\n\n**作者**：${result.author}\n\n---\n\n${result.content}`;
      }

      const filePath = path.join(folder, `${safeTitle}.md`);
      fs.mkdirSync(folder, { recursive: true });
      fs.writeFileSync(filePath, mdContent);
      console.log(`✅ 保存成功：${filePath}`);
      writeLog({ status: 'success', title: result.title, url, filePath });
    } catch (err) {
      console.error(`❌ 抓取失败：${url}`);
      console.error(err.message);
      writeErrorLog({ status: 'error', title: '', url, error: err.message });
    }
  }

  await browser.close();

  // 🧹 清空链接文件
  fs.writeFileSync('links.txt', '', 'utf-8');
  console.log('🧹 已清空 links.txt 文件');
})();
