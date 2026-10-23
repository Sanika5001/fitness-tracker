#pragma once

#include <string>
#include <memory>
#include "UserManager.h"
#include "Exercise.h"
#include "WorkoutPlan.h"
#include "User.h"

inline void seedDemo(UserManager& userMgr) {
    User existing;
    if (userMgr.getUser("demo", existing)) {
        return;
    }

    std::string errMsg;
    if (!userMgr.registerUser("demo", "demo123", 68.0, errMsg)) {
        return;
    }

    // Seed past 6 days: at least one entry each day
    // Day -6: Running (Cardio)
    std::shared_ptr<Exercise> dummyOut;
    userMgr.logExercise("demo",
        std::make_shared<Cardio>("Running", 25, 8.0, 226.0, DateHelper::getFormattedDate(-6)),
        dummyOut);

    // Day -5: Push-ups (Strength)
    userMgr.logExercise("demo",
        std::make_shared<Strength>("Push-ups", 15, 4, 20, 40.0, DateHelper::getFormattedDate(-5)),
        dummyOut);

    // Day -4: Cycling (Cardio)
    userMgr.logExercise("demo",
        std::make_shared<Cardio>("Cycling", 35, 7.5, 297.0, DateHelper::getFormattedDate(-4)),
        dummyOut);

    // Day -3: Skipping (Cardio)
    userMgr.logExercise("demo",
        std::make_shared<Cardio>("Skipping", 20, 9.0, 204.0, DateHelper::getFormattedDate(-3)),
        dummyOut);

    // Day -2: Squats (Strength)
    userMgr.logExercise("demo",
        std::make_shared<Strength>("Squats", 20, 5, 20, 50.0, DateHelper::getFormattedDate(-2)),
        dummyOut);

    // Day -1: Plank (Strength)
    userMgr.logExercise("demo",
        std::make_shared<Strength>("Plank", 15, 3, 30, 45.0, DateHelper::getFormattedDate(-1)),
        dummyOut);

    // Day 0 (Today): 3 entries totalling 660 kcal (Running 280 kcal, Push-ups 60 kcal, Cycling 320 kcal)
    userMgr.logExercise("demo",
        std::make_shared<Cardio>("Running", 30, 8.24, 280.0, DateHelper::getFormattedDate(0)),
        dummyOut);

    userMgr.logExercise("demo",
        std::make_shared<Strength>("Push-ups", 10, 4, 30, 60.0, DateHelper::getFormattedDate(0)),
        dummyOut);

    userMgr.logExercise("demo",
        std::make_shared<Cardio>("Cycling", 45, 6.27, 320.0, DateHelper::getFormattedDate(0)),
        dummyOut);

    // Add 3 Workout Plans
    WorkoutPlan plan1("Morning cardio");
    plan1.addExercise(std::make_shared<Cardio>("Running", 20, 7.5, 170.0, DateHelper::getFormattedDate(0)));
    plan1.addExercise(std::make_shared<Cardio>("Cycling", 20, 6.5, 147.0, DateHelper::getFormattedDate(0)));
    plan1.addExercise(std::make_shared<Cardio>("Skipping", 10, 8.0, 90.0, DateHelper::getFormattedDate(0)));
    userMgr.addPlan("demo", plan1, errMsg);

    WorkoutPlan plan2("Upper body");
    plan2.addExercise(std::make_shared<Strength>("Push-ups", 15, 4, 20, 40.0, DateHelper::getFormattedDate(0)));
    plan2.addExercise(std::make_shared<Strength>("Plank", 10, 3, 30, 45.0, DateHelper::getFormattedDate(0)));
    userMgr.addPlan("demo", plan2, errMsg);

    WorkoutPlan plan3("Leg day");
    plan3.addExercise(std::make_shared<Strength>("Squats", 20, 4, 25, 50.0, DateHelper::getFormattedDate(0)));
    plan3.addExercise(std::make_shared<Cardio>("Skipping", 15, 8.0, 136.0, DateHelper::getFormattedDate(0)));
    userMgr.addPlan("demo", plan3, errMsg);
}
