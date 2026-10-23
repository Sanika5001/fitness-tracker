#pragma once

#include <string>
#include <memory>
#include <iostream>
#include "third_party/json.hpp"

class Exercise {
protected:
    std::string name;
    int durationMin{0};
    double calories{0.0};
    std::string date;

public:
    Exercise(std::string name, int durationMin, double calories, std::string date)
        : name(std::move(name)), durationMin(durationMin), calories(calories), date(std::move(date)) {}
    virtual ~Exercise() = default;

    const std::string& getName() const { return name; }
    int getDurationMin() const { return durationMin; }
    double getCalories() const { return calories; }
    const std::string& getDate() const { return date; }

    void setCalories(double cal) { calories = cal; }
    void setDate(const std::string& d) { date = d; }

    virtual double calculateCalories(double weightKg) = 0;
    virtual std::string getType() const = 0;

    virtual nlohmann::json toJson() const {
        return {
            {"type", getType()},
            {"name", name},
            {"durationMin", durationMin},
            {"calories", calories},
            {"date", date}
        };
    }

    static std::shared_ptr<Exercise> fromJson(const nlohmann::json& j);

    friend std::ostream& operator<<(std::ostream& os, const Exercise& ex) {
        os << "[" << ex.getType() << "] " << ex.name << " ("
           << ex.durationMin << " min, " << ex.calories << " kcal, " << ex.date << ")";
        return os;
    }
};

class Cardio : public Exercise {
private:
    double met{1.0};

public:
    Cardio(std::string name, int durationMin, double met, double calories = 0.0, std::string date = "")
        : Exercise(std::move(name), durationMin, calories, std::move(date)), met(met) {}

    double getMet() const { return met; }
    std::string getType() const override { return "cardio"; }

    double calculateCalories(double weightKg) override {
        calories = met * weightKg * (static_cast<double>(durationMin) / 60.0);
        return calories;
    }

    nlohmann::json toJson() const override {
        auto j = Exercise::toJson();
        j["met"] = met;
        return j;
    }
};

class Strength : public Exercise {
private:
    int sets{0};
    int reps{0};

public:
    Strength(std::string name, int durationMin, int sets, int reps, double calories = 0.0, std::string date = "")
        : Exercise(std::move(name), durationMin, calories, std::move(date)), sets(sets), reps(reps) {}

    int getSets() const { return sets; }
    int getReps() const { return reps; }
    std::string getType() const override { return "strength"; }

    double calculateCalories(double /*weightKg*/) override {
        calories = static_cast<double>(sets * reps) * 0.5;
        return calories;
    }

    nlohmann::json toJson() const override {
        auto j = Exercise::toJson();
        j["sets"] = sets;
        j["reps"] = reps;
        return j;
    }
};

inline std::shared_ptr<Exercise> Exercise::fromJson(const nlohmann::json& j) {
    std::string type = j.value("type", "cardio");
    std::string name = j.value("name", "Exercise");
    int duration = j.value("durationMin", 0);
    double calories = j.value("calories", 0.0);
    std::string date = j.value("date", "");

    if (type == "cardio") {
        double met = j.value("met", 6.0);
        return std::make_shared<Cardio>(name, duration, met, calories, date);
    } else {
        int sets = j.value("sets", 3);
        int reps = j.value("reps", 10);
        return std::make_shared<Strength>(name, duration, sets, reps, calories, date);
    }
}
