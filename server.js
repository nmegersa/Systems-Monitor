import path from "path";
import express from "express";
import { engine } from "express-handlebars";

const app = express();

app.engine(
  "hbs",
  engine({
    extname: ".hbs",
    defaultLayout: false,   
    layoutsDir: false,
    partialsDir: false,
  })
);

app.set("view engine", "hbs");
app.set("views", path.join(process.cwd(), "views"));

// serve static files
app.use("/static", express.static("frontend/static"));

app.get("/", (req, res) => {
  const mode = req.query.mode === "range" ? "range" : "latest";

  const allowedMinutes = [5, 15, 60, 360, 1440];
  const requestedMinutes = Number.parseInt(req.query.minutes, 10);
  const minutes = allowedMinutes.includes(requestedMinutes) ? requestedMinutes : 15;

  const rangeOptions = [
    { value: 5,    label: "Last 5 Minutes",  selected: minutes === 5 },
    { value: 15,   label: "Last 15 Minutes", selected: minutes === 15 },
    { value: 60,   label: "Last 60 Minutes", selected: minutes === 60 },
    { value: 360,  label: "Last 6 Hours",    selected: minutes === 360 },
    { value: 1440, label: "Last 24 Hours",   selected: minutes === 1440 },
  ];

  res.render("dashboard", {
    title: "Dashboard — Systems Monitor",

    homeHref: "/",
    dashboardHref: "/",
    aboutHref: "/about",

    isDashboard: true,
    isAbout: false,

    isLatestMode: mode === "latest",
    isRangeMode: mode === "range",

    rangeHiddenClass: mode === "range" ? "" : "d-none",

    rangeOptions,
    statusText: "Ready",

    dashboardJsPath: "/static/dashboard.js",
  });
});


app.get("/about", (req, res) => {
  res.render("about", {
    title: "About — Systems Monitor",
    
    homeHref: "/",
    dashboardHref: "/",
    aboutHref: "/about",
    isDashboard: false,
    isAbout: true,
  });
});

app.listen(3000, () => console.log("Frontend running on http://localhost:3000"));
