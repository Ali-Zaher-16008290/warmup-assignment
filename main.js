const fs = require("fs");



function convertToSeconds(timeStr) { // Helper function to convert time string to seconds

    let parts = timeStr.trim().split(" ");
    let time = parts[0];
    let period = parts[1].toLowerCase();

    let timeParts = time.split(":");

    let hours = parseInt(timeParts[0]);
    let minutes = parseInt(timeParts[1]);
    let seconds = parseInt(timeParts[2]);

    if (period === "pm" && hours !== 12) {
        hours += 12;
    }

    if (period === "am" && hours === 12) {
        hours = 0;
    }

    return hours * 3600 + minutes * 60 + seconds;
}



function convertSecondsToTime(totalSeconds) {   // Helper function to convert seconds back to time string

    let hours = Math.floor(totalSeconds / 3600);
    let remaining = totalSeconds % 3600;

    let minutes = Math.floor(remaining / 60);
    let seconds = remaining % 60;

    minutes = minutes.toString().padStart(2, "0");
    seconds = seconds.toString().padStart(2, "0");

    return hours + ":" + minutes + ":" + seconds;
}



function convertDurationToSeconds(duration) {  // Helper function to convert duration string to seconds

    let parts = duration.split(":");

    let hours = parseInt(parts[0]);
    let minutes = parseInt(parts[1]);
    let seconds = parseInt(parts[2]);

    return hours * 3600 + minutes * 60 + seconds;
}


// Helper to get the day name (e.g. "Saturday") from a yyyy-mm-dd date string
function getDayName(dateStr) {
    let d = new Date(dateStr + "T00:00:00");
    let days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[d.getDay()];
}


// ============================================================
// Function 1: getShiftDuration(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getShiftDuration(startTime, endTime) {
    let startSeconds = convertToSeconds(startTime);
    let endSeconds = convertToSeconds(endTime);

    let durationSeconds = endSeconds - startSeconds;

    return convertSecondsToTime(durationSeconds);
}

// ============================================================
// Function 2: getIdleTime(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getIdleTime(startTime, endTime) {
    let start = convertToSeconds(startTime);
    let end = convertToSeconds(endTime);

    let deliveryStart = convertToSeconds("8:00:00 am");
    let deliveryEnd = convertToSeconds("10:00:00 pm");

    let idle = 0;

    // Time before delivery window starts
    if (start < deliveryStart) {
        // Idle is from start to min(end, deliveryStart)
        let idleEnd = Math.min(end, deliveryStart);
        idle += idleEnd - start;
    }

    // Time after delivery window ends
    if (end > deliveryEnd) {
        // Idle is from max(start, deliveryEnd) to end
        let idleStart = Math.max(start, deliveryEnd);
        idle += end - idleStart;
    }

    return convertSecondsToTime(idle);
}

// ============================================================
// Function 3: getActiveTime(shiftDuration, idleTime)
// shiftDuration: (typeof string) formatted as h:mm:ss
// idleTime: (typeof string) formatted as h:mm:ss
// Returns: string formatted as h:mm:ss
// ============================================================
function getActiveTime(shiftDuration, idleTime) {
    let shiftSeconds = convertDurationToSeconds(shiftDuration);
    let idleSeconds = convertDurationToSeconds(idleTime);

    let activeSeconds = shiftSeconds - idleSeconds;

    return convertSecondsToTime(activeSeconds);
}

// ============================================================
// Function 4: metQuota(date, activeTime)
// date: (typeof string) formatted as yyyy-mm-dd
// activeTime: (typeof string) formatted as h:mm:ss
// Returns: boolean
// ============================================================
function metQuota(date, activeTime) {
    let activeSeconds = convertDurationToSeconds(activeTime);

    let normalQuota = convertDurationToSeconds("8:24:00");
    let eidQuota = convertDurationToSeconds("6:00:00");

    let quota;

    if (date >= "2025-04-10" && date <= "2025-04-30") {
        quota = eidQuota;
    } else {
        quota = normalQuota;
    }

    return activeSeconds >= quota;
}



// ============================================================
// Function 5: addShiftRecord(textFile, shiftObj)
// textFile: (typeof string) path to shifts text file
// shiftObj: (typeof object) has driverID, driverName, date, startTime, endTime
// Returns: object with 10 properties or empty object {}
// ============================================================
function addShiftRecord(textFile, shiftObj) {
    let data = fs.readFileSync(textFile, "utf8");

    let lines = data.trim().split("\n");

    // Remove any blank lines
    lines = lines.filter(line => line.trim() !== "");

    // Check for duplicate: same driverID AND same date
    for (let line of lines) {
        let parts = line.split(",");
        let id = parts[0].trim();
        let date = parts[2].trim();

        if (id === shiftObj.driverID && date === shiftObj.date) {
            return {};
        }
    }

    let shiftDuration = getShiftDuration(shiftObj.startTime, shiftObj.endTime);
    let idleTime = getIdleTime(shiftObj.startTime, shiftObj.endTime);
    let activeTime = getActiveTime(shiftDuration, idleTime);
    let quotaMet = metQuota(shiftObj.date, activeTime);
    let hasBonus = false;

    let newRecord =
        shiftObj.driverID + "," +
        shiftObj.driverName + "," +
        shiftObj.date + "," +
        shiftObj.startTime + "," +
        shiftObj.endTime + "," +
        shiftDuration + "," +
        idleTime + "," +
        activeTime + "," +
        quotaMet + "," +
        hasBonus;

    // Find the insertion point: after the last record of this driverID
    let lastIndex = -1;
    for (let i = 0; i < lines.length; i++) {
        let parts = lines[i].split(",");
        if (parts[0].trim() === shiftObj.driverID) {
            lastIndex = i;
        }
    }

    if (lastIndex === -1) {
        // Driver not found at all — append to end
        lines.push(newRecord);
    } else {
        // Insert after the last record of this driverID
        lines.splice(lastIndex + 1, 0, newRecord);
    }

    fs.writeFileSync(textFile, lines.join("\n"));

    return {
        driverID: shiftObj.driverID,
        driverName: shiftObj.driverName,
        date: shiftObj.date,
        startTime: shiftObj.startTime,
        endTime: shiftObj.endTime,
        shiftDuration: shiftDuration,
        idleTime: idleTime,
        activeTime: activeTime,
        metQuota: quotaMet,
        hasBonus: false
    };
}

// ============================================================
// Function 6: setBonus(textFile, driverID, date, newValue)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// date: (typeof string) formatted as yyyy-mm-dd
// newValue: (typeof boolean)
// Returns: nothing (void)
// ============================================================
function setBonus(textFile, driverID, date, newValue) {
    let data = fs.readFileSync(textFile, "utf8");

    let lines = data.trim().split("\n");

    for (let i = 0; i < lines.length; i++) {
        let parts = lines[i].split(",");

        if (parts[0].trim() === driverID && parts[2].trim() === date) {
            parts[9] = newValue;
            lines[i] = parts.join(",");
        }
    }

    fs.writeFileSync(textFile, lines.join("\n"));
}

// ============================================================
// Function 7: countBonusPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof string) formatted as mm or m
// Returns: number (-1 if driverID not found)
// ============================================================
function countBonusPerMonth(textFile, driverID, month) {
    let lines = fs.readFileSync(textFile, "utf8").trim().split("\n");

    let found = false;
    let count = 0;

    for (let line of lines) {
        if (line.trim() === "") continue;

        let cols = line.split(",");

        if (cols[0].trim() === driverID) {
            found = true;

            let recordMonth = Number(cols[2].trim().split("-")[1]);
            let bonusValue = cols[9].trim().toLowerCase();

            if (recordMonth === Number(month) && bonusValue === "true") {
                count++;
            }
        }
    }

    if (!found) return -1;

    return count;
}


// ============================================================
// Function 8: getTotalActiveHoursPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getTotalActiveHoursPerMonth(textFile, driverID, month) {
    let data = fs.readFileSync(textFile, "utf8");

    let lines = data.trim().split("\n");

    let total = 0;

    for (let line of lines) {
        if (line.trim() === "") continue;

        let parts = line.split(",");

        if (parts[0].trim() === driverID) {
            let date = parts[2].trim();
            let active = parts[7].trim();

            let monthFromDate = parseInt(date.split("-")[1]);

            if (monthFromDate === month) {
                total += convertDurationToSeconds(active);
            }
        }
    }

    return convertSecondsToTime(total);
}

// ============================================================
// Function 9: getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month)
// textFile: (typeof string) path to shifts text file
// rateFile: (typeof string) path to driver rates text file
// bonusCount: (typeof number) total bonuses for given driver per month
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {
    let shifts = fs.readFileSync(textFile, "utf8").trim().split("\n");
    let rates = fs.readFileSync(rateFile, "utf8").trim().split("\n");

    // Find the driver's day off
    let dayOff = "";
    for (let line of rates) {
        if (line.trim() === "") continue;
        let parts = line.split(",");
        if (parts[0].trim() === driverID) {
            dayOff = parts[1].trim();
        }
    }

    let total = 0;

    for (let line of shifts) {
        if (line.trim() === "") continue;

        let parts = line.split(",");

        if (parts[0].trim() === driverID) {
            let date = parts[2].trim();
            let monthFromDate = parseInt(date.split("-")[1]);

            if (monthFromDate === month) {
                // Skip days that fall on the driver's day off
                let dayName = getDayName(date);
                if (dayName === dayOff) continue;

                let quota;
                if (date >= "2025-04-10" && date <= "2025-04-30") {
                    quota = convertDurationToSeconds("6:00:00");
                } else {
                    quota = convertDurationToSeconds("8:24:00");
                }

                total += quota;
            }
        }
    }

    // Each bonus reduces required hours by 2 hours
    total -= bonusCount * 2 * 3600;

    // Ensure total doesn't go negative
    if (total < 0) total = 0;

    return convertSecondsToTime(total);
}

// ============================================================
// Function 10: getNetPay(driverID, actualHours, requiredHours, rateFile)
// driverID: (typeof string)
// actualHours: (typeof string) formatted as hhh:mm:ss
// requiredHours: (typeof string) formatted as hhh:mm:ss
// rateFile: (typeof string) path to driver rates text file
// Returns: integer (net pay)
// ============================================================
function getNetPay(driverID, actualHours, requiredHours, rateFile) {
    let rates = fs.readFileSync(rateFile, "utf8").trim().split("\n");

    let basePay = 0;
    let tier = 0;

    for (let line of rates) {
        if (line.trim() === "") continue;

        let parts = line.split(",");

        if (parts[0].trim() === driverID) {
            basePay = parseInt(parts[2].trim());
            tier = parseInt(parts[3].trim());
        }
    }

    // Tier -> allowed missing hours (no deduction)
    let allowed = [0, 50, 20, 10, 3];

    let actual = convertDurationToSeconds(actualHours);
    let required = convertDurationToSeconds(requiredHours);

    // No deduction if actual >= required
    if (actual >= required) return basePay;

    let missing = required - actual;

    // Subtract the allowed grace hours for this tier
    missing -= allowed[tier] * 3600;

    // If missing is within the allowed range, no deduction
    if (missing <= 0) return basePay;

    // Only full hours are billable
    let billableHours = Math.floor(missing / 3600);

    let deductionRate = Math.floor(basePay / 185);

    let deduction = billableHours * deductionRate;

    return basePay - deduction;
}

module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord,
    setBonus,
    countBonusPerMonth,
    getTotalActiveHoursPerMonth,
    getRequiredHoursPerMonth,
    getNetPay
};