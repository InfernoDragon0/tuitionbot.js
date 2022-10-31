const { Telegraf, Scenes, Markup, session } = require('telegraf')
require('dotenv').config()
var mysql = require('mysql');
const fastcsv = require("fast-csv");
const fs = require('fs');
const pdf = require('pdfkit');

var con = mysql.createConnection({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DB
});

const bot = new Telegraf(process.env.BOT_TOKEN)

const attendanceDayLesson = new Scenes.WizardScene("ATTENDANCE_DAY_LESSON",
    (ctx) => { //request DATE
        var username = ctx.from.username
        con.query(`SELECT * FROM teacher WHERE telegram_id=?`,[username], (err, results, fields) => {
            if (err) {
                throw err
            }
            if (results.length != 0) {
                ctx.wizard.state.teacherid = results[0].teacher_id
                ctx.reply("Would you like to update attendance for TODAY or a previous day? Reply with YYYY-MM-DD to select a previous day",
                Markup.inlineKeyboard([
                    Markup.button.callback("Today", 'TODAY'),
                ]))
                ctx.wizard.state.attendanceDay = "";
                return ctx.wizard.next()

            }
            else {
                ctx.reply("Hello, new user, there is no account linked to your Telegram username, please contact an administrator to add you.")
                return ctx.scene.leave()
            }
        })
        
    },
    (ctx) => { //user replies with date or TODAY
        var date = "none"
        if (ctx.update.callback_query) {
            // ctx.reply("You have selected TODAY")
            date = new Date()
        }
        else {
            var date = new Date(ctx.message.text)
            if (isNaN(date)) {
                ctx.reply("You must specify a date in YYYY-MM-DD or TODAY")
                return
            }
        }
        ctx.reply("the date is " + date)

        ctx.wizard.state.attendanceDay = date
        var teacherid = ctx.wizard.state.teacherid
        
        con.query(`SELECT * FROM lesson_directory WHERE teacher_id=?`, [teacherid],(err, results, fields) => {
            if (err) {
                throw err
            }
            if (results.length != 0) {
                
                var selection = "Select a lesson from the list below:"
                var lessons = {}
                
                var buttonArray = []
                for (var i = 0; i < results.length; i++) {
                    buttonArray.push([Markup.button.callback(results[i].schedules + " - " + results[i].lesson_name, results[i].lesson_id)])
                    lessons[results[i].lesson_id] = results[i].lesson_name
                }
                ctx.wizard.state.lessons = lessons
                ctx.reply(selection, Markup.inlineKeyboard(buttonArray))

                return ctx.wizard.next()

            }
            else {
                ctx.reply("There is no lessons for the day selected. You may run this command again via /attendance.")
                return ctx.scene.leave()
            }
        })
    },
    (ctx) => { //request WEEK, and send attendance csv
        var date = "none"
        if (ctx.update.callback_query) {
            if (ctx.wizard.state.lessons.hasOwnProperty(ctx.update.callback_query.data)) {
                ctx.wizard.state.selectedLesson = ctx.wizard.state.lessons[ctx.update.callback_query.data]
                ctx.wizard.state.selectedLessonID = ctx.update.callback_query.data
            }
            // ctx.reply("You have selected TODAY")
            var lessonid = ctx.wizard.state.selectedLessonID
            var date = ctx.wizard.state.attendanceDay
            var month = date.toLocaleString('default', { month: 'long' });
            var year = date.getFullYear()
            //select based on MONTH as well
            //TODO show csv of the current selected lesson
            // con.query(`SELECT s.student_id, s.full_name, t.payment_status, t.attendance1,  t.attendance2, t.attendance3, t.attendance4, t.attendance5, t.attendance6 FROM student s 
            // inner join enrolment t on s.student_id = t.student_id
            // WHERE s.student_id in (SELECT t.student_id FROM tuition.enrolment t WHERE lesson_id=?) AND month=? AND year=?`, [lessonid, month, year], (err, results, fields) => {
            //     if (err) {
            //         throw err
            //     }
            //     if (results.length != 0) {
            //         var name = `attendance${new Date().getTime()}.csv`
            //         const ws = fs.createWriteStream(name);
            //         fastcsv
            //         .write(results, { headers: true })
            //         .pipe(ws)
            //         .on("finish", function() {
            //           console.log("send!");
            //           fs.readFile(name,(err, data) => {
            //             if (!err) {
            //                 ctx.telegram.sendDocument(ctx.from.id, {source: data, filename: "attendance.csv"})
            //                 fs.unlink(name, (err) => {
            //                     if (err)
            //                         console.log("error deleting " + err)
            //                 })
            //             }
            //             else {
            //                 ctx.reply("Cannot generate schedule overview, but the process can continue")
            //             }
            //           })
                      
            //         })
    
            //     }
            //     else {
            //         ctx.reply("There are no students for this lesson.")
            //     }
            // })

            con.query(`SELECT 
                    ld.lesson_name, 
                    s.full_name, 
                    t.payment_status, t.year, t.month, t.attendance1,t.attendance2,t.attendance3,t.attendance4,t.attendance5,t.attendance6,
                    tc.name
                    FROM student s 
                    INNER JOIN enrolment t on s.student_id = t.student_id 
                    INNER JOIN lesson_directory ld on t.lesson_id = ld.lesson_id
                    INNER JOIN teacher tc on tc.teacher_id = ld.teacher_id 
                    WHERE s.student_id in 
                    (SELECT t.student_id FROM tuition.enrolment t WHERE lesson_id=?) AND t.month=? AND t.year=?`,
                    [lessonid, month, year], (err, results, fields) => {
                    if (err) {
                        throw err
                    }
                    if (results.length != 0) { //THE DATA THAT IS RETRIEVED WILL ONLY BE THE LATEST REPORT
                        ctx.reply("Retrieved Lesson Data. Now generating Lesson Report")
                        //then list out (remark) that are of the [lesson_id and month and year] from the lesson_progress (callback hell, better than getting 4k bytes per student)
                        con.query(`SELECT * from lesson_remarks WHERE lesson_id = ? AND MONTH = ? AND YEAR = ?`,
                            [lessonid, month, year], (err, resultsz, fields) => {
                            if (err) {
                                throw err
                            }
                            if (resultsz.length != 0) {
                                ctx.reply("Retrieved Lesson Report. Generating remark report.")
                                for (var i = 0; i < resultsz.length; i++) {
                                    results.push(resultsz[i])
                                }
                            }
                            else {
                                ctx.reply(`This lesson's remarks is not available on ${month} ${year}.`)
                            }
                            
                            var name = `remark${new Date().getTime()}.csv`
                            const ws = fs.createWriteStream(name);
                            fastcsv
                            .write(results, { headers: ["lesson_name", "full_name", "payment_status", "attendance1", "attendance2", "attendance3", "attendance4", "attendance5", "attendance6",
                            "name", "month", "year", "week", "remark"] })
                            .pipe(ws)
                            .on("finish", function() {
                                
                                console.log("json " + JSON.stringify(results));
                                fs.readFile(name,(err, data) => {
                                    if (!err) {
                                        ctx.telegram.sendDocument(ctx.from.id, {source: data, filename: "remark.csv"})
                                        fs.unlink(name, (err) => {
                                            if (err)
                                                console.log("error deleting " + err)
                                        })
                                    }
                                    else {
                                        ctx.reply("Cannot generate remarks, please try again later.")
                                    }
                                })
                            })
                        })
            
                    }
                    else {
                        ctx.reply(`This lesson is not available on ${month} ${year}. please run the command again.`)
                    }
                })

            ctx.reply("Select the week for the attendance", 
            Markup.inlineKeyboard([
                [Markup.button.callback("Week 1", 'Week 1')],
                [Markup.button.callback("Week 2", 'Week 2')],
                [Markup.button.callback("Week 3", 'Week 3')],
                [Markup.button.callback("Week 4", 'Week 4')],
                [Markup.button.callback("Extra 1", 'Extra 1')],
                [Markup.button.callback("Extra 2", 'Extra 2')],
            ]))
            return ctx.wizard.next()
        }
        else {
            ctx.reply("You must specify a lesson")
            return
            
        }


    },
    (ctx) => { //Confirmation
        if (ctx.update.callback_query) {
            if(ctx.update.callback_query.data) {
                ctx.wizard.state.week = ctx.update.callback_query.data
                ctx.reply("You have selected " + ctx.wizard.state.attendanceDay + " and " + ctx.wizard.state.selectedLesson + " for " + ctx.wizard.state.week + ", YES to confirm.",
                Markup.inlineKeyboard([
                    Markup.button.callback("Yes", 'yes'),
                    Markup.button.callback("Cancel", 'cancel')
                ]))
            }
        }
        
        else {
            ctx.reply("Invalid selection, try again!")
            return
        }

        
        return ctx.wizard.next()
    },
    (ctx) => { //add remarks, show attendance list
        if (ctx.update.callback_query) {
            switch (ctx.update.callback_query.data) {
                case "yes":
                    showAttendanceList(ctx.wizard.state.attendanceDay, ctx.wizard.state.selectedLesson, ctx)
                    ctx.reply("You may add remarks if any, or select No Remarks. [Max CHINESE characters: 1024, max ENGLISH characters: 4096]", 
                    Markup.inlineKeyboard([
                        Markup.button.callback("No Remarks", 'cancel'),
                    ]))
                    return ctx.wizard.next()
                case "cancel":
                default:
                    ctx.reply("You may request this command again by /attendance")
                    break
            }
        }
        else {
            ctx.reply("Please select a command above.")
            return
        }
        
        return ctx.scene.leave()
    },
    (ctx) => { //update remarks, and exit
        var date = ctx.wizard.state.attendanceDay
        var lessonid = ctx.wizard.state.selectedLessonID
        var teacherid = ctx.wizard.state.teacherid
        var month = date.toLocaleString('default', { month: 'long' });
        var year = date.getFullYear()
        if (ctx.message) {
            var text = ctx.message.text
            var updatedon = new Date().toLocaleDateString()
            var week = ctx.wizard.state.week
           

            console.log("text is " + text)
            con.query(`INSERT INTO lesson_remarks (lesson_id,teacher_id,updated_on,week,month,year,remark) VALUES (?,?,?,?,?,?,?)`,
                [lessonid, teacherid, updatedon,week, month, year, text], (err, results, fields) => {
                    if (err) {
                        throw err
                    }
                    if (results.length != 0) {
                        ctx.reply("Lesson remarks has been updated. You may run this command again via /attendance.")
                    }
                    else {
                        ctx.reply("Error inserting your remarks, please try again.")
                        return
                    }
                })
            
            
        }
        else if (ctx.update.callback_query) {
            ctx.reply("You may run this command again via /attendance.")
        }
        else {
            ctx.reply("Error processing your remarks, please try again.")
            return
        }
        
        // con.query(`SELECT s.student_id, s.full_name, t.payment_status, t.attendance1,  t.attendance2, t.attendance3, t.attendance4, t.attendance5, t.attendance6 FROM student s 
        //     inner join enrolment t on s.student_id = t.student_id
        //     WHERE s.student_id in (SELECT t.student_id FROM tuition.enrolment t WHERE lesson_id=?) AND month=? AND year=?`, [lessonid, month, year], (err, results, fields) => {
        //         if (err) {
        //             throw err
        //         }
        //         if (results.length != 0) {
        //             var name = `attendance${new Date().getTime()}.csv`
        //             const ws = fs.createWriteStream(name);
        //             fastcsv
        //             .write(results, { headers: true })
        //             .pipe(ws)
        //             .on("finish", function() {
        //               console.log("send with remarks");
        //               fs.readFile(name,(err, data) => {
        //                 if (!err) {
        //                     ctx.telegram.sendDocument(ctx.from.id, {source: data, filename: "attendance.csv"})
        //                     fs.unlink(name, (err) => {
        //                         if (err)
        //                             console.log("error deleting " + err)
        //                     })
        //                     return ctx.scene.leave()
        //                 }
        //                 else {
        //                     ctx.reply("Cannot generate schedule overview, but the process can continue")
        //                     return ctx.scene.leave()
        //                 }
        //               })
                      
        //             })
    
        //         }
        //         else {
        //             ctx.reply("There are no students for this lesson.")
        //             return ctx.scene.leave()
        //         }
        //     })
        con.query(`SELECT 
                    ld.lesson_name, 
                    s.full_name, 
                    t.payment_status, t.year, t.month, t.attendance1,t.attendance2,t.attendance3,t.attendance4,t.attendance5,t.attendance6,
                    tc.name
                    FROM student s 
                    INNER JOIN enrolment t on s.student_id = t.student_id 
                    INNER JOIN lesson_directory ld on t.lesson_id = ld.lesson_id
                    INNER JOIN teacher tc on tc.teacher_id = ld.teacher_id 
                    WHERE s.student_id in 
                    (SELECT t.student_id FROM tuition.enrolment t WHERE lesson_id=?) AND t.month=? AND t.year=?`,
                    [lessonid, month, year], (err, results, fields) => {
                    if (err) {
                        throw err
                    }
                    if (results.length != 0) { //THE DATA THAT IS RETRIEVED WILL ONLY BE THE LATEST REPORT
                        ctx.reply("Retrieved Lesson Data. Now generating Lesson Report")
                        //then list out (remark) that are of the [lesson_id and month and year] from the lesson_progress (callback hell, better than getting 4k bytes per student)
                        con.query(`SELECT * from lesson_remarks WHERE lesson_id = ? AND MONTH = ? AND YEAR = ?`,
                            [lessonid, month, year], (err, resultsz, fields) => {
                            if (err) {
                                throw err
                            }
                            if (resultsz.length != 0) {
                                ctx.reply("Retrieved Lesson Report. Generating remark report.")
                                for (var i = 0; i < resultsz.length; i++) {
                                    results.push(resultsz[i])
                                }
                            }
                            else {
                                ctx.reply(`This lesson's remarks is not available on ${month} ${year}.`)
                            }
                            
                            var name = `remark${new Date().getTime()}.csv`
                            const ws = fs.createWriteStream(name);
                            fastcsv
                            .write(results, { headers: ["lesson_name", "full_name", "payment_status", "attendance1", "attendance2", "attendance3", "attendance4", "attendance5", "attendance6",
                            "name", "month", "year", "week", "remark"] })
                            .pipe(ws)
                            .on("finish", function() {
                                
                                console.log("json " + JSON.stringify(results));
                                fs.readFile(name,(err, data) => {
                                    if (!err) {
                                        ctx.telegram.sendDocument(ctx.from.id, {source: data, filename: "remark.csv"})
                                        fs.unlink(name, (err) => {
                                            if (err)
                                                console.log("error deleting " + err)
                                        })
                                    }
                                    else {
                                        ctx.reply("Cannot generate remarks, please try again later.")
                                    }
                                })
                            })
                        })
            
                    }
                    else {
                        ctx.reply(`This lesson is not available on ${month} ${year}. please run the command again.`)
                    }
                })

        return ctx.scene.leave()
    },
)

const monthlyLessonRemarks = new Scenes.WizardScene("MONTHLY_LESSON_REMARK",
    (ctx) => { //request DATE
        var username = ctx.from.username
        con.query(`SELECT * FROM teacher WHERE telegram_id=?`, [username], (err, results, fields) => {
            if (err) {
                throw err
            }
            if (results.length != 0) {
                ctx.wizard.state.teacherid = results[0].teacher_id
                ctx.reply("Select a month to update remarks for.",
                Markup.inlineKeyboard([
                    [Markup.button.callback("Jan", 'January'),
                    Markup.button.callback("Feb", 'February'),
                    Markup.button.callback("Mar", 'March'),
                    Markup.button.callback("Apr", 'April')],
                    [Markup.button.callback("May", 'May'),
                    Markup.button.callback("Jun", 'June'),
                    Markup.button.callback("Jul", 'July'),
                    Markup.button.callback("Aug", 'August')],
                    [Markup.button.callback("Sep", 'September'),
                    Markup.button.callback("Oct", 'October'),
                    Markup.button.callback("Nov", 'November'),
                    Markup.button.callback("Dec", 'December')],
                ]))
                return ctx.wizard.next()

            }
            else {
                ctx.reply("Hello, new user, there is no account linked to your Telegram username, please contact an administrator to add you.")
                return ctx.scene.leave()
            }
        })
        
    },
    (ctx) => { //request YEAR
        var date = "none"
        if (ctx.update.callback_query) {
            date = ctx.update.callback_query.data
            ctx.wizard.state.attendanceMonth = date
            ctx.reply("Enter a Year to update for in YYYY.")
            return ctx.wizard.next()
        }
        else {
            ctx.reply("You must select a month to update.")
            return
        }
    },
    (ctx) => { //request LESSON
        var date = "none"
        if (ctx.message) {
            date = ctx.message.text
            if (isNaN(date)) {
                ctx.reply("You must enter a year to update.")
                return
            }
        }
        else {
            ctx.reply("You must enter a year to update.")
            return
        }

        ctx.wizard.state.attendanceYear = date
        var teacherid = ctx.wizard.state.teacherid

        con.query(`SELECT * FROM lesson_directory WHERE teacher_id=?`, [teacherid],(err, results, fields) => {
            if (err) {
                throw err
            }
            if (results.length != 0) {
                
                var selection = "Select a lesson from the list below:"
                var lessons = {}
                
                var buttonArray = []
                for (var i = 0; i < results.length; i++) {
                    buttonArray.push([Markup.button.callback(results[i].schedules + " - " + results[i].lesson_name, results[i].lesson_id)])
                    lessons[results[i].lesson_id] = results[i].lesson_name
                }
                ctx.wizard.state.lessons = lessons
                ctx.reply(selection, Markup.inlineKeyboard(buttonArray))

                return ctx.wizard.next()

            }
            else {
                ctx.reply("No lessons available. You may run this command again via /progress.")
                return ctx.scene.leave()
            }
        })
    },
    (ctx) => { //finally, request the sentence to write into the remarks
        if (ctx.update.callback_query) {
            var month = ctx.wizard.state.attendanceMonth
            var year = ctx.wizard.state.attendanceYear

            if (ctx.wizard.state.lessons.hasOwnProperty(ctx.update.callback_query.data)) {
                ctx.wizard.state.selectedLesson = ctx.wizard.state.lessons[ctx.update.callback_query.data]
                ctx.wizard.state.selectedLessonID = ctx.update.callback_query.data
                ctx.reply(`You have selected ${ctx.wizard.state.selectedLesson} and ${month} ${year}`)
                ctx.reply("Please enter your remarks, or cancel to try again. [Max CHINESE characters: 1024, max ENGLISH characters: 4096]", 
                Markup.inlineKeyboard([
                    Markup.button.callback("Cancel", 'cancel'),
                ]))
                return ctx.wizard.next()
            }
            else {
                ctx.reply("There was an error getting the lesson, please try the command again.")
                return ctx.scene.leave()
            }
        }
        else {
            ctx.reply("You must specify a lesson")
            return
        }
    },
    (ctx) => { //update into db
        if (ctx.update.callback_query) {
            if(ctx.update.callback_query.data == "cancel") {
                ctx.reply("You may run this command again via /progress.")
                return ctx.scene.leave()
            }
            else {
                return
            }
        }
        
        else {
            if (ctx.message) { //TODO: update into lesson monthly
                var text = ctx.message.text
                var lessonid = ctx.wizard.state.selectedLessonID
                var teacherid = ctx.wizard.state.teacherid
                var updatedon = new Date().toLocaleDateString()
                var month = ctx.wizard.state.attendanceMonth
                var year = ctx.wizard.state.attendanceYear

                console.log("text is " + text)
                con.query(`INSERT INTO lesson_progress (lesson_id,teacher_id,updated_on,month,year,remark) VALUES (?,?,?,?,?,?)`,
                    [lessonid, teacherid, updatedon, month, year, text], (err, results, fields) => {
                        if (err) {
                            throw err
                        }
                        if (results.length != 0) {
                            ctx.reply("Lesson progress has been updated. You may run this command again via /progress.")
                            return ctx.scene.leave()
                        }
                        else {
                            ctx.reply("Error inserting your remarks, please try again.")
                            return
                        }
                    })
                
            }
            else {
                ctx.reply("Error processing your remarks, please try again.")
                return
            }
        }
    },
)

const generateLessonProgress = new Scenes.WizardScene("GENERATE_MONTHLY_PROGRESS",
    (ctx) => { //check if admin and ask for month
        var username = ctx.from.username
        con.query(`SELECT * FROM teacher WHERE telegram_id=?`, [username], (err, results, fields) => {
            if (err) {
                throw err
            }
            if (results.length != 0) {
                ctx.wizard.state.teacherid = results[0].teacher_id
                ctx.reply("Select a month to generate remarks for.",
                Markup.inlineKeyboard([
                    [Markup.button.callback("Jan", 'January'),
                    Markup.button.callback("Feb", 'February'),
                    Markup.button.callback("Mar", 'March'),
                    Markup.button.callback("Apr", 'April')],
                    [Markup.button.callback("May", 'May'),
                    Markup.button.callback("Jun", 'June'),
                    Markup.button.callback("Jul", 'July'),
                    Markup.button.callback("Aug", 'August')],
                    [Markup.button.callback("Sep", 'September'),
                    Markup.button.callback("Oct", 'October'),
                    Markup.button.callback("Nov", 'November'),
                    Markup.button.callback("Dec", 'December')],
                ]))
                return ctx.wizard.next()
            }
            else {
                ctx.reply("Hello, new user, there is no account linked to your Telegram username, please contact an administrator to add you.")
                return ctx.scene.leave()
            }
        })
    },
    (ctx) => { //request YEAR
        var date = "none"
        if (ctx.update.callback_query) {
            date = ctx.update.callback_query.data
            ctx.wizard.state.attendanceMonth = date
            ctx.reply("Enter a Year to request for in YYYY.")
            return ctx.wizard.next()
        }
        else {
            ctx.reply("You must select a month to request.")
            return
        }
    },
    (ctx) => { //request LESSON
        var date = "none"
        if (ctx.message) {
            date = ctx.message.text
            if (isNaN(date)) {
                ctx.reply("You must enter a year to request.")
                return
            }
        }
        else {
            ctx.reply("You must enter a year to request.")
            return
        }

        ctx.wizard.state.attendanceYear = date
        var month = ctx.wizard.state.attendanceMonth

        con.query(`SELECT ld.schedules, ld.lesson_id, ld.lesson_name FROM lesson_progress lp 
            INNER JOIN lesson_directory ld on lp.lesson_id = ld.lesson_id
            WHERE lp.month=? AND lp.year=? GROUP BY lesson_id`, [month,date],(err, results, fields) => {
            if (err) {
                throw err
            }
            if (results.length != 0) {
                
                var selection = "Select a lesson from the list below:"
                var lessons = {}
                
                var buttonArray = []
                for (var i = 0; i < results.length; i++) {
                    buttonArray.push([Markup.button.callback(results[i].schedules + " - " + results[i].lesson_name, results[i].lesson_id)])
                    lessons[results[i].lesson_id] = results[i].lesson_name
                }
                ctx.wizard.state.lessons = lessons
                ctx.reply(selection, Markup.inlineKeyboard(buttonArray))

                return ctx.wizard.next()

            }
            else {
                ctx.reply("No progress report available for this month and year. You may run this command again via /adminprogress.")
                return ctx.scene.leave()
            }
        })
    },
    (ctx) => { //finally, generate
        if (ctx.update.callback_query) {
            var month = ctx.wizard.state.attendanceMonth
            var year = ctx.wizard.state.attendanceYear

            if (ctx.wizard.state.lessons.hasOwnProperty(ctx.update.callback_query.data)) {
                ctx.wizard.state.selectedLesson = ctx.wizard.state.lessons[ctx.update.callback_query.data]
                ctx.wizard.state.selectedLessonID = ctx.update.callback_query.data
                ctx.reply(`You have selected ${ctx.wizard.state.selectedLesson} and ${month} ${year}`)
                ctx.reply("Report is being generated. Please wait.")

                var lessonid = ctx.wizard.state.selectedLessonID
                var year = ctx.wizard.state.attendanceYear
                var month = ctx.wizard.state.attendanceMonth
                //list out the (lesson_name) that is of [lesson_id] from lesson_directory
                //then list out the (teacher_name) that is of [teacher_id] from teacher
                //then list out the (students, attendance1-6) that are of the [lesson_id and month and year] from enrolment,
                con.query(`SELECT 
                    ld.lesson_name, 
                    s.full_name, 
                    t.payment_status, t.year, t.month, t.attendance1,t.attendance2,t.attendance3,t.attendance4,t.attendance5,t.attendance6,
                    tc.name
                    FROM student s 
                    INNER JOIN enrolment t on s.student_id = t.student_id 
                    INNER JOIN lesson_directory ld on t.lesson_id = ld.lesson_id
                    INNER JOIN teacher tc on tc.teacher_id = ld.teacher_id 
                    WHERE s.student_id in 
                    (SELECT t.student_id FROM tuition.enrolment t WHERE lesson_id=?) AND t.month=? AND t.year=?`,
                    [lessonid, month, year], (err, results, fields) => {
                    if (err) {
                        throw err
                    }
                    if (results.length != 0) { //THE DATA THAT IS RETRIEVED WILL ONLY BE THE LATEST REPORT
                        ctx.reply("Retrieved Lesson Data. Now generating Lesson Report")
                        //then list out (remark) that are of the [lesson_id and month and year] from the lesson_progress (callback hell, better than getting 4k bytes per student)
                        con.query(`SELECT * from lesson_progress WHERE lesson_id = ? AND MONTH = ? AND YEAR = ?`,
                            [lessonid, month, year], (err, resultsz, fields) => {
                            if (err) {
                                throw err
                            }
                            if (resultsz.length != 0) {
                                ctx.reply("Retrieved Lesson Report. Generating progress report.")
                                
                    
                                //then send as a pdf file
                                var name = `report${new Date().getTime()}.pdf`
                                const ws = fs.createWriteStream(name);
                                
                                const doc = new pdf()
                                doc.registerFont('Noto Sans SC', __dirname + '/NotoSansSC-Regular.otf')
                                doc.font('Noto Sans SC')
                                doc.fontSize(16).text("Lesson Name")
                                doc.fontSize(10).text(results[0].lesson_name)
                                doc.fontSize(10).text(" ")

                                doc.fontSize(16).text("Lesson Teacher")
                                doc.fontSize(10).text(results[0].name)
                                doc.fontSize(10).text(" ")


                                doc.fontSize(16).text("Student Attendance")
                                for (var i = 0; i < results.length; i++) {
                                    var textResult = " "
                                    if (results[i].attendance1) {
                                        textResult += `Wk1 ${results[i].attendance1} | `
                                    }
                                    if (results[i].attendance2) {
                                        textResult += `Wk2 ${results[i].attendance2} | `
                                    }
                                    if (results[i].attendance3) {
                                        textResult += `Wk3 ${results[i].attendance3} | `
                                    }
                                    if (results[i].attendance4) {
                                        textResult += `Wk4 ${results[i].attendance4} | `
                                    }
                                    if (results[i].attendance5) {
                                        textResult += `Wk5 ${results[i].attendance5} | `
                                    }
                                    if (results[i].attendance6) {
                                        textResult += `Wk6 ${results[i].attendance6}`
                                    }

                                    doc.fontSize(10).text(`${results[i].full_name}`)
                                    doc.fontSize(8).text(textResult)
                                    doc.fontSize(10).text(" ")
                                }
                                
                                
                                doc.fontSize(16).text("Monthly Progress Report")
                                doc.fontSize(10).text(resultsz[resultsz.length - 1].remark)

                                doc.pipe(ws).on("finish", function() {
                                    console.log("send!");
                                    fs.readFile(name,(err, data) => {
                                        if (!err) {
                                            ctx.telegram.sendDocument(ctx.from.id, {source: data, filename: "Report.pdf"})
                                            fs.unlink(name, (err) => {
                                                if (err)
                                                    console.log("error deleting " + err)
                                            })
                                        }
                                        else {
                                            ctx.reply("Cannot generate report PDF.")
                                        }
                                    })
                                })
                                
                                doc.end()

                                return ctx.scene.leave()
                            }
                            else {
                                ctx.reply(`This lesson's report is not available on ${month} ${year}. please run the command again.`)
                                return ctx.scene.leave()
                            }
                        })
            
                    }
                    else {
                        ctx.reply(`This lesson is not available on ${month} ${year}. please run the command again.`)
                        return ctx.scene.leave()
                    }
                })
                return ctx.scene.leave()
            }
            else {
                ctx.reply("There was an error getting the lesson, please try the command again.")
                return ctx.scene.leave()
            }
        }
        else {
            ctx.reply("You must specify a lesson")
            return
        }
    },
)
const generateLessonRemark = new Scenes.WizardScene("GENERATE_LESSON_REMARK",
    (ctx) => { //check if admin and ask for month
        var username = ctx.from.username
        con.query(`SELECT * FROM teacher WHERE telegram_id=?`, [username], (err, results, fields) => {
            if (err) {
                throw err
            }
            if (results.length != 0) {
                ctx.wizard.state.teacherid = results[0].teacher_id
                ctx.reply("Select a month to generate remarks for.",
                Markup.inlineKeyboard([
                    [Markup.button.callback("Jan", 'January'),
                    Markup.button.callback("Feb", 'February'),
                    Markup.button.callback("Mar", 'March'),
                    Markup.button.callback("Apr", 'April')],
                    [Markup.button.callback("May", 'May'),
                    Markup.button.callback("Jun", 'June'),
                    Markup.button.callback("Jul", 'July'),
                    Markup.button.callback("Aug", 'August')],
                    [Markup.button.callback("Sep", 'September'),
                    Markup.button.callback("Oct", 'October'),
                    Markup.button.callback("Nov", 'November'),
                    Markup.button.callback("Dec", 'December')],
                ]))
                return ctx.wizard.next()
            
            }
            else {
                ctx.reply("Hello, new user, there is no account linked to your Telegram username, please contact an administrator to add you.")
                return ctx.scene.leave()
            }
        })
    },
    (ctx) => { //request YEAR
        var date = "none"
        if (ctx.update.callback_query) {
            date = ctx.update.callback_query.data
            ctx.wizard.state.attendanceMonth = date
            ctx.reply("Enter a Year to request for in YYYY.")
            return ctx.wizard.next()
        }
        else {
            ctx.reply("You must select a month to request.")
            return
        }
    },
    (ctx) => { //request LESSON
        var date = "none"
        if (ctx.message) {
            date = ctx.message.text
            if (isNaN(date)) {
                ctx.reply("You must enter a year to request.")
                return
            }
        }
        else {
            ctx.reply("You must enter a year to request.")
            return
        }

        ctx.wizard.state.attendanceYear = date
        var month = ctx.wizard.state.attendanceMonth

        con.query(`SELECT ld.schedules, ld.lesson_id, ld.lesson_name FROM lesson_remarks lp 
            INNER JOIN lesson_directory ld on lp.lesson_id = ld.lesson_id
            WHERE lp.month=? AND lp.year=? GROUP BY lesson_id`, [month,date],(err, results, fields) => {
            if (err) {
                throw err
            }
            if (results.length != 0) {
                
                var selection = "Select a lesson from the list below:"
                var lessons = {}
                
                var buttonArray = []
                for (var i = 0; i < results.length; i++) {
                    buttonArray.push([Markup.button.callback(results[i].schedules + " - " + results[i].lesson_name, results[i].lesson_id)])
                    lessons[results[i].lesson_id] = results[i].lesson_name
                }
                ctx.wizard.state.lessons = lessons
                ctx.reply(selection, Markup.inlineKeyboard(buttonArray))

                return ctx.wizard.next()

            }
            else {
                ctx.reply("No lesson remarks available for this month and year. You may run this command again via /adminprogress.")
                return ctx.scene.leave()
            }
        })
    },
    (ctx) => { //finally, generate
        if (ctx.update.callback_query) {
            var month = ctx.wizard.state.attendanceMonth
            var year = ctx.wizard.state.attendanceYear

            if (ctx.wizard.state.lessons.hasOwnProperty(ctx.update.callback_query.data)) {
                ctx.wizard.state.selectedLesson = ctx.wizard.state.lessons[ctx.update.callback_query.data]
                ctx.wizard.state.selectedLessonID = ctx.update.callback_query.data
                ctx.reply(`You have selected ${ctx.wizard.state.selectedLesson} and ${month} ${year}`)
                ctx.reply("Remarks is being generated. Please wait.")

                var lessonid = ctx.wizard.state.selectedLessonID
                var year = ctx.wizard.state.attendanceYear
                var month = ctx.wizard.state.attendanceMonth
                //list out the (lesson_name) that is of [lesson_id] from lesson_directory
                //then list out the (teacher_name) that is of [teacher_id] from teacher
                //then list out the (students, attendance1-6) that are of the [lesson_id and month and year] from enrolment,
                con.query(`SELECT 
                    ld.lesson_name, 
                    s.full_name, 
                    t.payment_status, t.year, t.month, t.attendance1,t.attendance2,t.attendance3,t.attendance4,t.attendance5,t.attendance6,
                    tc.name
                    FROM student s 
                    INNER JOIN enrolment t on s.student_id = t.student_id 
                    INNER JOIN lesson_directory ld on t.lesson_id = ld.lesson_id
                    INNER JOIN teacher tc on tc.teacher_id = ld.teacher_id 
                    WHERE s.student_id in 
                    (SELECT t.student_id FROM tuition.enrolment t WHERE lesson_id=?) AND t.month=? AND t.year=?`,
                    [lessonid, month, year], (err, results, fields) => {
                    if (err) {
                        throw err
                    }
                    if (results.length != 0) { //THE DATA THAT IS RETRIEVED WILL ONLY BE THE LATEST REPORT
                        ctx.reply("Retrieved Lesson Data. Now generating Lesson Report")
                        //then list out (remark) that are of the [lesson_id and month and year] from the lesson_progress (callback hell, better than getting 4k bytes per student)
                        con.query(`SELECT * from lesson_remarks WHERE lesson_id = ? AND MONTH = ? AND YEAR = ?`,
                            [lessonid, month, year], (err, resultsz, fields) => {
                            if (err) {
                                throw err
                            }
                            if (resultsz.length != 0) {
                                ctx.reply("Retrieved Lesson Report. Generating remark report.")

                                for (var i = 0; i < resultsz.length; i++) {
                                    results.push(resultsz[i])
                                }
                                
                                var name = `remark${new Date().getTime()}.csv`
                                const ws = fs.createWriteStream(name);
                                fastcsv
                                .write(results, { headers: ["lesson_name", "full_name", "payment_status", "attendance1", "attendance2", "attendance3", "attendance4", "attendance5", "attendance6",
                                "name", "month", "year", "week", "remark"] })
                                .pipe(ws)
                                .on("finish", function() {
                                    
                                    console.log("json " + JSON.stringify(results));
                                    fs.readFile(name,(err, data) => {
                                        if (!err) {
                                            ctx.telegram.sendDocument(ctx.from.id, {source: data, filename: "remark.csv"})
                                            fs.unlink(name, (err) => {
                                                if (err)
                                                    console.log("error deleting " + err)
                                            })
                                        }
                                        else {
                                            ctx.reply("Cannot generate remarks, please try again later.")
                                        }
                                    })
                                
                                })
                                //then send as a csv file
                                

                                return ctx.scene.leave()
                            }
                            else {
                                ctx.reply(`This lesson's remarks is not available on ${month} ${year}. please run the command again.`)
                                return ctx.scene.leave()
                            }
                        })
            
                    }
                    else {
                        ctx.reply(`This lesson is not available on ${month} ${year}. please run the command again.`)
                        return ctx.scene.leave()
                    }
                })
                return ctx.scene.leave()
            }
            else {
                ctx.reply("There was an error getting the lesson, please try the command again.")
                return ctx.scene.leave()
            }
        }
        else {
            ctx.reply("You must specify a lesson")
            return
        }
    },
)

const stage = new Scenes.Stage([attendanceDayLesson, monthlyLessonRemarks, generateLessonProgress, generateLessonRemark])

var pollStorage = {} //array of pollID: [names] {pollid: [name1,name2]}
var onlineStorage = {} //array of online pollID: [names] {pollid: [name1,name2]}

loadDatabase = () => {
    con.connect((err) => {
        if (err) throw err;
        console.log("Connected to database");
    })
}

loadDatabase()

bot.start((ctx) => {
    var userid = ctx.from.id
    var username = ctx.from.username
    var message = `Hello, this bot is under maintainance, please try again later.`
    
    con.query(`SELECT * FROM teacher WHERE telegram_id=?`,[username], (err, results, fields) => {
        if (err) {
            throw err
        }
        if (results.length == 0) {
            message = "Hello, new user, there is no account linked to your Telegram username, please contact an administrator to add you."
        }
        else {
            message = `Hello, ${results[0].name}. Select /attendance to get started with taking attendance, or /progress to update monthly lesson progress`
        }
        ctx.reply(message)
    })
})

bot.use(session())
bot.use(stage.middleware())

bot.telegram.setMyCommands([
    {command: '/start', description: 'starts the bot'},
    {command: '/lessonprogress', description: 'update monthly lesson progress'},
    {command: '/adminprogress', description: 'Generate Lesson report with Lesson Progress'},
    {command: '/lessonattendancereport', description: 'generate lesson remarks'},
    {command: '/attendance', description: 'update your class attendance'}
])

showAttendanceList = (day, lesson, ctx) => {
    //create a ctx.replyWithPoll for each 10 users that exist, save the poll ID, and the poll data into a store
    var lessonid = ctx.wizard.state.selectedLessonID
    var date = ctx.wizard.state.attendanceDay
    var month = date.toLocaleString('default', { month: 'long' });
    var year = date.getFullYear()
    con.query(`SELECT s.student_id, s.full_name, t.payment_status FROM student s INNER JOIN enrolment t on s.student_id = t.student_id WHERE s.student_id in 
    (SELECT t.student_id FROM tuition.enrolment t WHERE lesson_id=?) AND month=? AND year=?`,[lessonid,month,year], (err, results, fields) => {
        if (err) {
            throw err
        }
        if (results.length != 0) {

            var pollsArray = []
            var poll = []
            var week = ctx.wizard.state.week
            for (var i = 0; i < results.length; i++) {
                poll.push(`${results[i].full_name} - ${results[i].payment_status}`)
                if (i % 10 == 9 && poll.length > 0) {
                    if (poll.length == 1) {
                        poll.push("do not select") //these are because polls must have at least 2 options
                    }
                    pollsArray.push(poll)
                    console.log("pushed a poll of " + poll)
                    poll = []
                }
            }

            if (poll.length > 0) {
                if (poll.length == 1) {
                    poll.push("do not select") //these are because polls must have at least 2 options
                }
                pollsArray.push(poll)
                console.log("pushed the last poll")
            }

            console.log("the poll array has " + pollsArray)

            for (let pollz of pollsArray) {
                ctx.replyWithPoll("Select Attendance (PHYSICAL)", pollz, {"allows_multiple_answers": true, "is_anonymous": false}
                ).then((data) => {
                    
                    console.log("poll created: " + data.poll.id)
                    pollStorage[data.poll.id] = {"poll": pollz, "date": day, "lesson": lesson, "week": week}
                })
            }

        }
        else {
            ctx.reply("There are no students for this lesson. You may run this command again via /attendance.")
        }
    })

}

bot.command('attendance', Scenes.Stage.enter('ATTENDANCE_DAY_LESSON'))
bot.command('lessonprogress', Scenes.Stage.enter('MONTHLY_LESSON_REMARK'))
bot.command('adminprogress', Scenes.Stage.enter('GENERATE_MONTHLY_PROGRESS'))
bot.command('lessonattendancereport', Scenes.Stage.enter('GENERATE_LESSON_REMARK'))

bot.on("poll_answer", (pollAnswer) => {
    var selectedAttendance = pollAnswer.pollAnswer.option_ids
    var pollID =  pollAnswer.pollAnswer.poll_id
    var chatID = pollAnswer.pollAnswer.user.id
    console.log("you polled " + JSON.stringify(selectedAttendance) + " For " + pollID)
    console.log("Current poll data is " + JSON.stringify(pollStorage))
    pollResultConfirmed(selectedAttendance, pollID, chatID)
})

bot.launch()

pollResultConfirmed = (selectedAttendance, pollID,chatID) => {
    //use the poll data to update attendance
    if (pollStorage.hasOwnProperty(pollID)) {
        console.log("polled data " + JSON.stringify(pollStorage[pollID]) + " and " + selectedAttendance)

        //TODO: update the attendance taken here, based on date??

        var attendance = "Attendance (PHYSICAL) taken for " + pollStorage[pollID]["week"]
        var names = []
        for (selected of selectedAttendance) {
            attendance += `\n${selected}. ${pollStorage[pollID]["poll"][selected]}`
            names.push(pollStorage[pollID]["poll"][selected])
            //remove here
            //TODO: attendance here
            var selectedWeek = pollStorage[pollID]["week"]
            var attendanceUpdate = "attendance1"
            switch (selectedWeek) {
                case "Week 1":
                    attendanceUpdate = "attendance1"
                    break
                case "Week 2":
                    attendanceUpdate = "attendance2"
                    break
                case "Week 3":
                    attendanceUpdate = "attendance3"
                    break
                case "Week 4":
                    attendanceUpdate = "attendance4"
                    break
                case "Extra 1":
                    attendanceUpdate = "attendance5"
                    break
                case "Extra 2":
                    attendanceUpdate = "attendance6"
                    break
            }
            var nameupdate = pollStorage[pollID]["poll"][selected].split("-")[0]
            var date = pollStorage[pollID]["date"].toLocaleDateString()
            var month = pollStorage[pollID]["date"].toLocaleString('default', { month: 'long' });
            var year = pollStorage[pollID]["date"].getFullYear()

            con.query(`UPDATE enrolment SET ${attendanceUpdate} = ? WHERE student_id in 
                (SELECT student_id FROM student WHERE full_name=?) AND month=? AND year=?`,[`P ${date}`,nameupdate,month,year], (err, results, fields) => {
                if (err) {
                    throw err
                }
                console.log("results: " + results)
            })
        }
        var nextAttendance = pollStorage[pollID]["poll"].filter(item => !names.includes(item))
        var atn = {"poll": nextAttendance, "date": pollStorage[pollID]["date"], "lesson": pollStorage[pollID]["lesson"], "week": pollStorage[pollID]["week"]}
        delete pollStorage[pollID]
        
        
        bot.telegram.sendMessage(chatID, attendance)
        if (nextAttendance.length > 0 && nextAttendance[0] != "do not select") {
            if (nextAttendance.length == 1) {
                nextAttendance.push("do not select") //these are because polls must have at least 2 options
            }
            bot.telegram.sendPoll(chatID, "Select Attendance (ONLINE)", nextAttendance, {"allows_multiple_answers": true, "is_anonymous": false}
            ).then((data) => {
                console.log("online poll" + data.poll.id)
                onlineStorage[data.poll.id] = atn
            })
        }
        

        //TODO: update database here
    }
    else if (onlineStorage.hasOwnProperty(pollID)) {
        console.log("polled data " + JSON.stringify(onlineStorage[pollID]) + " and " + selectedAttendance)

        var attendance = "Attendance (ONLINE) taken for " + onlineStorage[pollID]["week"]
        for (selected of selectedAttendance) {
            attendance += `\n${selected}. ${onlineStorage[pollID]["poll"][selected]}`

            //TODO: attendance here
            var selectedWeek = onlineStorage[pollID]["week"]
            var attendanceUpdate = "attendance1"
            switch (selectedWeek) {
                case "Week 1":
                    attendanceUpdate = "attendance1"
                    break
                case "Week 2":
                    attendanceUpdate = "attendance2"
                    break
                case "Week 3":
                    attendanceUpdate = "attendance3"
                    break
                case "Week 4":
                    attendanceUpdate = "attendance4"
                    break
                case "Extra 1":
                    attendanceUpdate = "attendance5"
                    break
                case "Extra 2":
                    attendanceUpdate = "attendance6"
                    break
            }
            var nameupdate = onlineStorage[pollID]["poll"][selected].split("-")[0]
            var date = onlineStorage[pollID]["date"].toLocaleDateString()
            var month = onlineStorage[pollID]["date"].toLocaleString('default', { month: 'long' });
            var year = onlineStorage[pollID]["date"].getFullYear()

            con.query(`UPDATE enrolment SET ${attendanceUpdate} = "O ${date}" WHERE student_id in 
                (SELECT student_id FROM student WHERE full_name = "${nameupdate}") AND month="${month}" AND year="${year}"`, (err, results, fields) => {
                if (err) {
                    throw err
                }
                console.log("results: " + results)
            })
        }

        

        bot.telegram.sendMessage(chatID, attendance)
    }
    else {
        bot.telegram.sendMessage(chatID, "Please try again as the server has restarted since the attendance list was created.")
        console.log("Server lost data, cannot update")
    }
}