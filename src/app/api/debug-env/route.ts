
export async function GET() {

  return Response.json({

    NOTION_API_KEY: process.env.NOTION_API_KEY?.slice(0, 20) + "...",

    NOTION_STORIES_DB: process.env.NOTION_STORIES_DB,

    NOTION_JD_DB: process.env.NOTION_JD_DB,

    NOTION_INTERVIEW_DB: process.env.NOTION_INTERVIEW_DB,

    NOTION_KNOWLEDGE_DB: process.env.NOTION_KNOWLEDGE_DB,

    NOTION_DATABASE_ID: process.env.NOTION_DATABASE_ID,

  });

}

