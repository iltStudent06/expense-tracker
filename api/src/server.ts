import dotenv from "dotenv";

dotenv.config();

import app from "./app.js";

const port = Number(process.env.PORT) || 4000;

app.listen(port, () => {
  console.log(`Expense Dashboard API listening on port ${port}`);
});
