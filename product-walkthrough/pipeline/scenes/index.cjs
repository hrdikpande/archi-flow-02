/* Chapter order for the master video. Each file exports an array of chapters. */
module.exports = [
  ...require("./a-intro.cjs"), // 00 introduction, 01 sign-in and roles, 02 portfolio, 03 project dashboard
  ...require("./b-plan.cjs"), // 04 projects and stages, 05 register, 06 getting drawings in, 07 sheet page
  ...require("./c-flow.cjs"), // 08 designer, 09 checking and senior QC, 10 issue, 11 client's side
  ...require("./d-client.cjs"), // 12 comments and approvals, 13 billing
  ...require("./e-people.cjs"), // 14 workload and timesheets, 15 alerts and automation
  ...require("./f-later.cjs"), // 16 construction, 17 search, 18 reports, 19 intelligence
  ...require("./g-admin.cjs"), // 20 administration, 21 platform and close
];
