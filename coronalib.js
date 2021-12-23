"use strict"

var labels = null
var days = {}

function beforeDayZero(day) {
    return day["confirmed"] < 500
}

function getLabel(day, daynum)
{
    return daynum
}

function getDays(data, country) {
    var confirmed = []
    for (var day of data[country]) {
        if (beforeDayZero(day)) continue
        confirmed.push(day["confirmed"])

        if (confirmed.length > labels.length) labels.push(getLabel(day, labels.length))
    }
    days[country] = confirmed
    return confirmed
}

function getInfected(data, country) {
    var infected = []
    var last_valid_recovered = null // workaround data issue at JHU
    for (var day of data[country]) {
        if (beforeDayZero(day)) continue
        if (day["recovered"])
            last_valid_recovered = day["recovered"]
        infected.push(day["confirmed"] - day["deaths"] - last_valid_recovered)
    }
    return infected
}

function getFatalityRate(data, country) {
    var fatality = []
    for (var day of data[country]) {
        if (beforeDayZero(day)) continue
        fatality.push(day["deaths"] / day["confirmed"] * 100)
    }
    return fatality
}

function getDeadPerMillion(data, country) {
    var dead = []
    for (var day of data[country]) {
        if (beforeDayZero(day)) continue
        dead.push(day["deaths"] / (population[country] / 1e6))
    }
    return dead
}

function getRate(data, country) {
    var confirmed = days[country]
    var rate = [0]
    for (var i = 1; i < confirmed.length; i++) {
        rate.push((confirmed[i] / confirmed[i - 1]))
    }

    var avgd = new Array(7).fill(0)
    for (var i = 6; i < rate.length; i++) {
        avgd.push((rate[i] + rate[i - 1] + rate[i - 2] + rate[i - 3] + rate[i - 4] + rate[i - 5] + rate[i - 6]) / 7)
    }

    return avgd
}

function getRe(data, country) {
    var delta = 7 // days

    var confirmed = days[country]
    var rate = new Array(2*delta).fill(-1)

    for (var i = delta; i < confirmed.length; i++) {
        rate.push((confirmed[i] - confirmed[i - delta]) / (confirmed[i - delta] - confirmed[i - 2*delta]))
    }

    return rate
}

function getIncidence(data, country) {
    var delta = 7 // days

    var confirmed = days[country]
    var incidence = new Array(confirmed.length).fill(0)

    for (var i = delta; i < confirmed.length; i++) {
        // todays incidence
        var dc = Math.max(0, confirmed[i] - confirmed[i - 1])
        // add todays incidence to following 7 days
        for(var j = 0; j < delta; j++)
            incidence[Math.min(i + j, confirmed.length)] += dc
    }

    for (var i = 0; i < incidence.length; i++) {
        incidence[i] /= (population[country] / 1e5)
    }

    return incidence
}

function getDoublingTime(data, country) {
    return getRate(data, country).map(rate => Math.log(2) / Math.log(rate))
}

function getDatasets(data, fn, countries, fill) {
    var colors = ['rgb(255, 132, 255)', 'rgb(255, 99, 132)', 'rgb(99, 255, 132)', 'rgb(99, 132, 255)', 'rgb(132, 255, 255)', 'rgb(255, 255, 132)']
    var datasets = []

    for (var i = 0; i < countries.length; i++) {
        datasets.push(
            {
                label: countries[i],
                fill: fill,
                backgroundColor: colors[i],
                borderColor: colors[i],
                data: fn(data, countries[i]).map(x => x.toFixed(2))
            }
        )
    }

    return datasets
}

Chart.defaults.global.defaultFontColor = 'white'
Chart.defaults.scale.gridLines.color = "rgba(255,255,255, 0.2)"
var config = {
    // The type of chart we want to create
    type: 'line',

    // The data for our dataset
    data: {
        datasets: null,
        labels: null
    },

    // Configuration options go here
    options: {
        responsive: true,
        maintainAspectRatio: false,
        title: {
            display: true,
            text: 'Corona Confirmed Comparison'
        },
        tooltips: {
            mode: 'index',
            intersect: false,
        },
        scales: {
            xAxes: [{
                display: true,
                scaleLabel: {
                    display: true,
                    labelString: 'Days since 500 confirmed'
                },
                ticks: {
                    maxTicksLimit: 30
                }
            }],
            yAxes: [{
                display: true,
                scaleLabel: {
                    display: true,
                    labelString: 'confirmed'
                },
                ticks: {}
            }]
        },
        animation: {
            duration: 0 // general animation time
        },
        hover: {
            animationDuration: 0 // duration of animations when hovering an item
        },
        responsiveAnimationDuration: 0, // animation duration after a resize
        elements: {
            point: {
                radius: 0 // default to disabled in all datasets
            }
        }
    }
}

var charts = {}

function makeChart(name, config) {
    var canvas = document.getElementById(name).getContext('2d')
    if (name in charts) charts[name].destroy()
    charts[name] = new Chart(canvas, config)
}

function mergeDays(from, to) {
    // not smart: quadratic complexity, but whatever
    outer:
    for (var d2 of from) {
        for (var i = 0; i < to.length; i++) {
            var d1 = to[i]
            if (d1.date == d2.date) {
                d1.confirmed += d2.confirmed
                d1.deaths += d2.deaths
                d1.recovered += d2.recovered
                continue outer
            }
        }
        to.splice(i, 0, Object.assign({}, d2))
    }
}

function aggregateEU(data, population) {
    var countries = ["Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czechia", "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary", "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg", "Malta", "Netherlands", "Poland", "Portugal", "Romania", "Slovakia", "Slovenia", "Spain", "Sweden"]
    console.assert(countries.length == 27, "https://en.wikipedia.org/wiki/Member_state_of_the_European_Union")

    data["EU"] = []
    population["EU"] = 0

    for (var c of countries) {
        mergeDays(data[c], data["EU"])
        population["EU"] += population[c]
    }
}

function show_autocomplete()
{
    var countries_str = document.getElementById('countries').value
    var elements = countries_str.split(";")
    var typing = elements[elements.length - 1].trim()
    
    var autocomplete = document.getElementById("autocomplete")
    autocomplete.classList.remove("show")
    if(typing.length < 2) return

    var re = RegExp("^"+typing, 'i')
    var matches = all_countries.filter(x => re.test(x))

    if(matches.length == 0) return

    let completeHTML = ""
    for (const m of matches) {
        completeHTML += `<a class="dropdown-item" href="#" onclick="complete(this)">${m}</a>`
    }

    autocomplete.innerHTML = completeHTML
    autocomplete.classList.add("show")
}

function complete(elt)
{
    var countries_str = document.getElementById('countries').value
    var elements = countries_str.split(";")
    elements[elements.length - 1] = " "+elt.innerText
    document.getElementById('countries').value = elements.join(";")
    document.getElementById('autocomplete').classList.remove("show")
}

async function refresh() {
    var countries_str = document.getElementById('countries').value
    var countries = countries_str.split(";").map(e => e.trim())

    var err = ""

    var response = await fetch("https://pomber.github.io/covid19/timeseries.json")
    var data = await response.json()

    all_countries = Object.keys(data)

    aggregateEU(data, population)

    var initial = !Object.keys(charts).length

    for (var c of countries) {
        if (!(c in data))
            err += c + " is not a know country name "
        if (!(c in population))
            err += " population of " + c + " not known"
    }

    if (err) {
        alert(err)
        return
    }

    if (!initial) {
        history.pushState(null, "title", "?countries=" + encodeURI(countries_str))
    }

    labels = [] // force recompute labels length

    makeCharts(data, countries)
}

var urlParams = new URLSearchParams(window.location.search)
var countries_str = urlParams.get('countries')
var all_countries = null

// fallback for old links
if (window.location.hash && !document.getElementById(window.location.hash.substring(1))) {
    countries_str = decodeURI(window.location.hash.substring(1))
}
if (countries_str) {
    document.getElementById('countries').value = countries_str
}