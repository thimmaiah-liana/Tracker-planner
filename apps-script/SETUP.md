# Apps Script Setup

## Steps to deploy the API

1. Go to [Google Apps Script](https://script.google.com)
2. Create a new project
3. Delete the default code and paste the contents of `Code.gs`
4. Click **Deploy** > **New deployment**
5. Select **Web app** as the type
6. Set:
   - **Execute as:** Me
   - **Who has access:** Anyone
7. Click **Deploy**
8. Copy the **Web app URL**
9. Open the Tracker's Planner app and paste the URL in **Settings > Setup**

## Spreadsheet ID

The script uses this spreadsheet:
`1Js4xwYQUQ_M8ti5upLr_v-2cneBDDiNJ7sFw5YefkgA`

If you create a new spreadsheet, update the `SHEET_ID` variable in `Code.gs`.
