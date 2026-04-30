const { Client } = require("@notionhq/client");
const dotenv = require("dotenv");
const path = require("path");

// 加载环境变量
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function test() {
  const dbs = [
    { name: "StoryBank", id: process.env.NOTION_STORIES_DB },
    { name: "JD Records", id: process.env.NOTION_JD_DB },
    { name: "Interview Records", id: process.env.NOTION_INTERVIEW_DB },
    { name: "Knowledge", id: process.env.NOTION_KNOWLEDGE_DB },
    {
      name: "Questions",
      id:
        process.env.NOTION_QUESTION_DB ||
        process.env.NOTION_QUESTIONS_DB ||
        process.env.NOTION_QUESTION_BANK_DB,
    },
    { name: "Resume", id: process.env.NOTION_RESUME_DB },
  ];

  console.log("🚀 开始 Notion 权限深度扫描...\n");
  console.log(`使用 Token: ${process.env.NOTION_API_KEY.substring(0, 10)}...`);

  for (const db of dbs) {
    try {
      if (!db.id) {
        console.error(`❌ [${db.name}] 失败: missing env var`);
        continue;
      }
      const response = await notion.databases.retrieve({ database_id: db.id });
      console.log(`✅ [${db.name}] 连接成功！数据库名称: ${response.title[0].plain_text}`);
    } catch (error) {
      console.error(`❌ [${db.name}] 失败: ${error.code} - ${error.message}`);
    }
  }
}

test();
