/**
 * Seed script for Indian National (Gazetted) Holidays.
 *
 * Usage:  node scripts/seed-indian-holidays.js [year]
 * Example: node scripts/seed-indian-holidays.js 2026
 *
 * If no year is provided, defaults to the current year.
 * Only inserts holidays that don't already exist (matched by name + year).
 */

import "../env.js";
import mongoose from "mongoose";
import { config } from "../config/database.js";
import Holiday from "../models/Holiday.js";

const year = parseInt(process.argv[2]) || new Date().getFullYear();

// Indian national recognized (gazetted) holidays
// Dates are approximate for recurring holidays; some (like Eid, Diwali) shift yearly.
// Update the dates below for the target year.
const INDIAN_NATIONAL_HOLIDAYS = [
  { name: "Republic Day", date: `${year}-01-26`, description: "Celebrates the adoption of the Indian Constitution" },
  { name: "Maha Shivaratri", date: `${year}-02-26`, description: "Hindu festival dedicated to Lord Shiva" },
  { name: "Holi", date: `${year}-03-17`, description: "Festival of colors" },
  { name: "Good Friday", date: `${year}-04-03`, description: "Christian observance of the crucifixion of Jesus" },
  { name: "Eid ul-Fitr", date: `${year}-03-31`, description: "Marks the end of Ramadan" },
  { name: "Ram Navami", date: `${year}-04-06`, description: "Celebrates the birth of Lord Rama" },
  { name: "Dr. Ambedkar Jayanti", date: `${year}-04-14`, description: "Birth anniversary of Dr. B.R. Ambedkar" },
  { name: "Mahavir Jayanti", date: `${year}-04-10`, description: "Birth anniversary of Lord Mahavir" },
  { name: "Buddha Purnima", date: `${year}-05-12`, description: "Celebrates the birth of Gautama Buddha" },
  { name: "Eid ul-Adha (Bakrid)", date: `${year}-06-07`, description: "Islamic festival of sacrifice" },
  { name: "Muharram", date: `${year}-06-27`, description: "Islamic New Year" },
  { name: "Independence Day", date: `${year}-08-15`, description: "Celebrates India's independence from British rule" },
  { name: "Milad-un-Nabi (Prophet's Birthday)", date: `${year}-09-05`, description: "Birth anniversary of Prophet Muhammad" },
  { name: "Mahatma Gandhi Jayanti", date: `${year}-10-02`, description: "Birth anniversary of Mahatma Gandhi" },
  { name: "Dussehra (Vijayadashami)", date: `${year}-10-02`, description: "Celebrates victory of good over evil" },
  { name: "Diwali", date: `${year}-10-20`, description: "Festival of lights" },
  { name: "Guru Nanak Jayanti", date: `${year}-11-05`, description: "Birth anniversary of Guru Nanak Dev" },
  { name: "Christmas Day", date: `${year}-12-25`, description: "Celebrates the birth of Jesus Christ" },
];

async function seed() {
  try {
    await mongoose.connect(config.uri);
    console.log(`Connected to MongoDB. Seeding Indian national holidays for ${year}...\n`);

    let inserted = 0;
    let skipped = 0;

    for (const h of INDIAN_NATIONAL_HOLIDAYS) {
      const holidayDate = new Date(h.date);
      // Check if this holiday already exists for the year (by name + approximate date range)
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

      const existing = await Holiday.findOne({
        name: h.name,
        date: { $gte: startOfYear, $lte: endOfYear },
      });

      if (existing) {
        console.log(`  ⏭  ${h.name} — already exists (${existing.date.toISOString().split("T")[0]})`);
        skipped++;
        continue;
      }

      await Holiday.create({
        name: h.name,
        date: holidayDate,
        type: "national",
        description: h.description,
        is_active: true,
      });

      console.log(`  ✅ ${h.name} — ${h.date}`);
      inserted++;
    }

    console.log(`\nDone! Inserted: ${inserted}, Skipped (already existed): ${skipped}`);
    process.exit(0);
  } catch (err) {
    console.error("Seed error:", err);
    process.exit(1);
  }
}

seed();
