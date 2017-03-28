/* Jacob Waro js for D3, Spring 2017 */

// Wrap everything in a self-executing anonymous function to move to local scope
(function(){

    //pseudo-global variables
    var attrArray = ["Seismic Events per 10000 square (km)", "Avg. Magnitude", "Avg. Depth (km)", "Population Density (km^2)", "Expected Tsunami Height severe case (m)"]; //list of attributes
    var expressed = attrArray[0]; //initial attribute

    //begin script when window loads
    window.onload = setMap();

    //set up choropleth map
    function setMap(){

        //map frame dimensions
        var width = window.innerWidth * 0.5,
            height = 675;

        //create new svg container for the map
        var map = d3.select("body")
            .append("svg")
            .attr("class", "map")
            .attr("width", width)
            .attr("height", height);

        //create Albers equal area conic projection centered on New Zealand
        var projection = d3.geoAlbers()
            .center([0, -40.75])
            .rotate([-173, 0, 0])
            .parallels([-38.5, -44.5])
            .scale(2750)
            .translate([width / 2, height / 2]);

        // draw the projection
        var path = d3.geoPath()
            .projection(projection);

        //use d3.queue to parallelize asynchronous data loading
        d3.queue()
            .defer(d3.csv, "data/D3_data.csv") //load attributes from csv
            .defer(d3.json, "data/NZ_Boundaries.topojson") //spatial data
            .await(callback);

        function callback(error, csvData, nz){

            //place graticule on the map
            setGraticule(map, path);

            //translate NZ TopoJSON
            var newZealandRegions = topojson.feature(nz, nz.objects.NZ_Boundaries).features;

            //join csv data to GeoJSON enumeration units
            newZealandRegions = joinData(newZealandRegions, csvData);

            //create the color scale
            var colorScale = makeColorScale(csvData);

            //add enumeration units to the map
            setEnumerationUnits(newZealandRegions, map, path, colorScale);

            //add coordinated visualization to the map
            setChart(csvData, colorScale);

        }; // end of callback
    }; // end of setMap

    //function to create coordinated bar chart
    function setChart(csvData, colorScale){

        // chart frame dimensions
        var chartWidth = window.innerWidth * 0.425,
            chartHeight = 473,
            leftPadding = 25,
            rightPadding = 2,
            topBottomPadding = 5,
            chartInnerWidth = chartWidth - leftPadding - rightPadding,
            chartInnerHeight = chartHeight - topBottomPadding * 2,
            translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

        //create a second svg element to hold the bar chart
        var chart = d3.select("body")
            .append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .attr("class", "chart");

        //create a rectangle for chart background fill
        var chartBackground = chart.append("rect")
            .attr("class", "chartBackground")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);

        //create a scale to size bars proportionally to frame and for axis
        var yScale = d3.scaleLinear()
            .range([463, 0])
            .domain([0, 50]);

        //set bars for each province
        var bars = chart.selectAll(".bar")
            .data(csvData)
            .enter()
            .append("rect")
            .sort(function(a, b){
                return b[expressed]-a[expressed]
            })
            .attr("class", function(d){
                return "bar " + d.Region;
            })
            .attr("width", chartInnerWidth / csvData.length - 1)
            .attr("x", function(d, i){
                return i * (chartInnerWidth / csvData.length) + leftPadding;
            })
            .attr("height", function(d, i){
                return 463 - yScale(parseFloat(d[expressed]));
            })
            .attr("y", function(d, i){
                return yScale(parseFloat(d[expressed])) + topBottomPadding;
            })
            .style("fill", function(d){
                return choropleth(d, colorScale);
            });

        // create a text element for the chart title
        var chartTitle = chart.append("text")
            .attr("x", 40)
            .attr("y", 40)
            .attr("class", "chartTitle")
            .text("Number of " + attrArray[0] + " in each region");

        // create vertical axis generator
        var yAxis = d3.axisLeft()
            .scale(yScale);

        //place axis
        var axis = chart.append("g")
            .attr("class", "axis")
            .attr("transform", translate)
            .call(yAxis);

        //create frame for chart border
        var chartFrame = chart.append("rect")
          .attr("class", "chartFrame")
          .attr("width", chartInnerWidth)
          .attr("height", chartInnerHeight)
          .attr("transform", translate);

    }; // close to setChart


    function setGraticule(map, path){
        //create graticule generator
        var graticule = d3.geoGraticule()
            .step([5, 5]); //place graticule lines every 5 degrees of longitude and latitude

        //create graticule background
        var gratBackground = map.append("path")
            .datum(graticule.outline()) //bind graticule background
            .attr("class", "gratBackground") //assign class for styling
            .attr("d", path); //project graticule

        //create graticule lines
        var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
            .data(graticule.lines()) //bind graticule lines to each element to be created
            .enter() //create an element for each datum
            .append("path") //append each element to the svg as a path element
            .attr("class", "gratLines") //assign class for styling
            .attr("d", path); //project graticule lines

    }; // end of setGraticule

    function joinData(newZealandRegions, csvData){

        for (var i = 0; i < csvData.length; i++){

            var csvRegion = csvData[i]; //the current region
            var csvKey = csvRegion.Region; //the CSV primary key

            //loop through geojson regions to find correct region
            for (var a = 0; a < newZealandRegions.length; a++){

                var geojsonProps = newZealandRegions[a].properties; //the current region geojson properties
                var geojsonKey = geojsonProps.Region; //the geojson primary key

                // where primary keys match, transfer csv data to geojson properties object
                if (geojsonKey == csvKey){

                    // assign all attributes and values
                    attrArray.forEach(function(attr){
                        var val = parseFloat(csvRegion[attr]); //get csv attribute value
                        geojsonProps[attr] = val; //assign attribute and value to geojson properties
                    });
                };
            };
        };

        return newZealandRegions;

    }; // end of joinData

    //function to test for data value and return color
    function choropleth(props, colorScale){

        //make sure attribute value is a number
        var val = parseFloat(props[expressed]);

        //if attribute value exists, assign a color; otherwise assign gray
        if (typeof val == 'number' && !isNaN(val)){
            return colorScale(val);
        } else {
            return "#CCC";
        };
    };

    function setEnumerationUnits(newZealandRegions, map, path, colorScale){

        //add NZ regions to map
        var regions = map.selectAll(".regions")
            .data(newZealandRegions)
            .enter()
            .append("path")
            .attr("class", function(d){
                return "regions " + d.properties.region;
            })
            .attr("d", path)
            .style("fill", function(d){
                return choropleth(d.properties, colorScale);
            });

    }; // end of setEnumerationUnits

    //function to create color scale generator
    function makeColorScale(data) {
        var colorClasses = [
            "#FFFFD4",
            "#FED98E",
            "#FE9929",
            "#D95F0E",
            "#993404"
        ];

        // create color scale generator
        var colorScale = d3.scaleQuantile()
            .range(colorClasses);

        // build array of all values of the expressed attribute
        var domainArray = [];
        for (var i = 0; i < data.length; i++){
            var val = parseFloat(data[i][expressed]);
            domainArray.push(val);
        };

        //assign array of expressed values as scale domain
        colorScale.domain(domainArray);

        return colorScale;

    }; // end of makeColorScale

})(); //last line of main.js
