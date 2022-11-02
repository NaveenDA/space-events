const express = require("express");

const cheerio = require("cheerio");
const request = require("request-promise");
const fs = require("fs");
const crypto = require("crypto");
const ics = require("ics");
const moment = require("moment");

const app = express();
const getSpaceEvents = async () => {
  url = "https://everydayastronaut.com/upcoming-launches/";
  const html = await request.get(url);
  const $ = cheerio.load(html);
  const events = [];
  $(".cs-posts-area article.post").each((i, elem) => {
    let link = trim($(elem).find(".cs-overlay-link").attr("href"));
    let date = trim($(elem).find(".launch-time > ul > li").text());
    date = date.replace("-", "");
    // create uuid based on name and date
    let item = {
      title: trim($(elem).find(".cs-entry__title").text()),
      date: date,
      location: trim(
        $(elem)
          .find(".cs-meta-category:nth-child(" + (link ? 3 : 2) + ") > ul > li")
          .text()
      ),
      description: `${trim($(elem).find(".cs-meta-category > ul > li").text())} \n`
    };

    if (link) {
      item.link = link;
    }
    item.uuid = crypto
      .createHash("md5")
      .update(item.title + item.date)
      .digest("hex");
    events.push(item);
  });
  return events;
};

let url;

const trim = (str) => {
  if (str) {
    return str.trim();
  } else {
    return "";
  }
};

const getAstronomyEvents = async () => {
  url = "https://www.timeanddate.com/astronomy/sights-to-see.html";
  const html = await request.get(url);
  const $ = cheerio.load(html);
  const events = [];
  $(".article__body .post-row").each((i, elem) => {
    let item = {
      title: trim($(elem).find("h3 a").text()),
      date: trim(shortMonthDate($(elem).find(".text-color-link--active").text())),
      description: `${trim($(elem).find("p").text())} \n`
    };
    item.uuid = crypto
      .createHash("md5")
      .update(item.title + item.date)
      .digest("hex");

    events.push(item);
  });
  return events;
};
// events for astronomy

const monthShortToNum = (month) => {
  const months = {
    jan: "January",
    january: "January",
    feb: "February",
    february: "February",
    march: "March",
    mar: "March",
    april: "April",
    apr: "April",
    may: "May",
    june: "June",
    jun: "June",
    july: "July",
    jul: "July",
    aug: "August",
    august: "August",
    sep: "September",
    sept: "September",
    september: "September",
    oct: "October",
    october: "October",

    nov: "November",
    november: "November",
    dec: "December",
    december: "December"
  };
  return months[month.toLowerCase()];
};
const shortMonthDate = (str) => {
  // remove :
  str = str.replace(":", "");
  let month = str.split(" ")[0];
  let day = str.split(" ")[1];
  if (str.includes("/")) {
    // Dec 13/14: Geminid Meteors
    let day1 = str.split("/")[0].split(" ")[1];
    let day2 = trim(str.split("/")[1]);
    return `${monthShortToNum(
      month
    )} ${day1}, ${new Date().getFullYear()} 00:00:00 UTC - ${monthShortToNum(
      month
    )} ${day2}, ${new Date().getFullYear()} 00:00:00 UTC`;
  }
  // Jan 20 -> 01, Janauary {Current Year}
  return `${monthShortToNum(month)} ${day}, ${new Date().getFullYear()} 00:00:00 UTC`;
};

app.get("/", async (req, res) => {
  const spaceEvents = await getSpaceEvents();
  const astronomyEvents = await getAstronomyEvents();
  const events = [...spaceEvents, ...astronomyEvents];
  const icsEvents = events.map((event) => {
    let date = event.date.split(" - ");
    let startDate = date[0];
    let endDate = date[1] || date[0];

    if (!endDate) {
      endDate = moment(startDate).add(1, "hours").format();
    }

    // date format [2018, 1, 15, 12, 15] from October 28, 2022 - 1:14:10 UTC
    startDate = moment(startDate).format("YYYY, MM, DD, HH, mm").split(", ");
    endDate = moment(endDate).format("YYYY, MM, DD, HH, mm").split(", ");
    startDate = startDate.map((item) => parseInt(item));
    endDate = endDate.map((item) => parseInt(item));
    return {
      title: event.title,
      start: startDate,
      end: endDate,
      description: event.description,
      url: event.link,
      uid: event.uuid
    };
  });

  const { error, value } = ics.createEvents(icsEvents);
  if (error) {
    console.log(error);
    res.status(500).send(error);
    return;
  }
  res.setHeader('content-type', 'text/calendar');

  res.send(value);
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
