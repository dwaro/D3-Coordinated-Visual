/* Jacob Waro js for D3, Spring 2017 */

// Wrap everything in a self-executing anonymous function to move to local scope
(function(){

    // pseudo-global variables
    var attrArray = ["Seismic Events per 10000 km²", "Avg. Earthquake Magnitude", "Avg. Depth of Earthquakes (km)", "Population Density (km²)", "Expected Tsunami Height (m/10000km²)"]; //list of attributes
    var expressed = attrArray[0]; //initial attribute

    // title html
    var title = "<b>Seismic Lands</b>";

    // creating a div for the title
    var titleLabel = d3.select("body")
        .append("div")
        .attr("class", "titleLabel")
        .html(title);

    // dates html
    var dates = "<b>Information for March 7th and 8th 2017<b>";

    // div for the dates
    var datesLabel = d3.select("body")
        .append("div")
        .attr("id", "datesLabel")
        .html(dates);

    // making domain height global
    var domainHeight;

    // chart frame dimensions
    var chartWidth = window.innerWidth * 0.425,
        chartHeight = 473,
        leftPadding = 25,
        rightPadding = 2,
        topBottomPadding = 5,
        chartInnerWidth = chartWidth - leftPadding - rightPadding,
        chartInnerHeight = chartHeight - topBottomPadding * 2,
        translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

    // create a scale to size bars proportionally to frame and for axis
    var yScale = d3.scaleLinear()
        .range([463, 0])
        .domain([0, 50])
        .nice();

    // create a second svg element to hold the bar chart
    var chart = d3.select("body")
        .append("svg")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .attr("class", "chart");

    // create vertical axis generator
    var yAxis = d3.axisLeft()
        .scale(yScale);

    // place axis
    var axis = chart.append("g")
        .attr("class", "axis")
        .attr("transform", translate)
        .transition()
        .call(yAxis);

    // begin script when window loads
    window.onload = setMap();

    // set up choropleth map
    function setMap(){

        // map frame dimensions
        var width = window.innerWidth * 0.5,
            height = 600;

        // create new svg container for the map
        var map = d3.select("body")
            .append("svg")
            .attr("class", "map")
            .attr("width", width)
            .attr("height", height);

        // create Albers equal area conic projection centered on New Zealand
        var projection = d3.geoAlbers()
            .center([0, -40.75])
            .rotate([-173, 0, 0])
            .parallels([-38.5, -44.5])
            .scale(2400)
            .translate([width / 2, height / 2]);

        // draw the projection
        var path = d3.geoPath()
            .projection(projection);

        // use d3.queue to parallelize asynchronous data loading
        d3.queue()
            .defer(d3.csv, "data/D3_data.csv") // load attributes from csv
            .defer(d3.json, "data/NZ_Boundaries.topojson") // spatial data
            .await(callback);

        function callback(error, csvData, nz, domainHeight){

            // add the dropdown menu
            createDropdown(csvData);

            // place graticule on the map
            setGraticule(map, path);

            // translate NZ TopoJSON
            var newZealandRegions = topojson.feature(nz, nz.objects.NZ_Boundaries).features;

            // join csv data to GeoJSON enumeration units
            newZealandRegions = joinData(newZealandRegions, csvData);

            // create the color scale
            var colorScale = makeColorScale(csvData);

            // add enumeration units to the map
            setEnumerationUnits(newZealandRegions, map, path, colorScale);

            // add coordinated visualization to the map
            setChart(csvData, colorScale);

        }; // end of callback
    }; // end of setMap

    // function to create coordinated bar chart
    function setChart(csvData, colorScale){

      //create a rectangle for chart background fill
      var chartBackground = chart.append("rect")
          .attr("class", "chartBackground")
          .attr("width", chartInnerWidth)
          .attr("height", chartInnerHeight)
          .attr("transform", translate);

      // set bars for each province
      var bars = chart.selectAll(".bar")
          .data(csvData)
          .enter()
          .append("rect")
          .sort(function(a, b){
              return b[expressed]-a[expressed]
          })
          .attr("class", function(d){
              return "bar " + d.Region.replace(/ /g, '');
          })
          .attr("width", chartInnerWidth / csvData.length - 1)
          .on("mouseover", highlight)
          .on("mouseout", dehighlight)
          .on("mousemove", moveLabel);

      // dehighlighting with a desc svg stroke
      var desc = bars.append("desc")
          .text('{"stroke": "none", "stroke-width": "0px"}');

      // create frame for chart border
      var chartFrame = chart.append("rect")
          .attr("class", "chartFrame")
          .attr("width", chartInnerWidth)
          .attr("height", chartInnerHeight)
          .attr("transform", translate);

        // set bar positions, heights, and colors
        updateChart(bars, csvData.length, colorScale);

    }; // close to setChart

    // function to create the background graticule for the map
    function setGraticule(map, path){

        // create graticule generator
        var graticule = d3.geoGraticule()
            .step([5, 5]); // place graticule lines every 5 degrees of longitude and latitude

        // create graticule background
        var gratBackground = map.append("path")
            .datum(graticule.outline()) // bind graticule background
            .attr("class", "gratBackground") // assign class for styling
            .attr("d", path); // project graticule

        // create graticule lines
        var gratLines = map.selectAll(".gratLines") // select graticule elements that will be created
            .data(graticule.lines()) // bind graticule lines to each element to be created
            .enter() // create an element for each datum
            .append("path") // append each element to the svg as a path element
            .attr("class", "gratLines") // assign class for styling
            .attr("d", path); // project graticule lines

    }; // end of setGraticule

    // function to join the topojson shapefile with the csv data
    function joinData(newZealandRegions, csvData){

        // stepping through the csvdata
        for (var i = 0; i < csvData.length; i++){

            var csvRegion = csvData[i]; // the current region
            var csvKey = csvRegion.Region; // the CSV primary key

            // loop through geojson regions to find correct region
            for (var a = 0; a < newZealandRegions.length; a++){

                // the current region geojson properties
                var geojsonProps = newZealandRegions[a].properties;
                var geojsonKey = geojsonProps.Region; // the geojson primary key

                // where primary keys match, transfer csv data to geojson properties object
                if (geojsonKey == csvKey){

                    // assign all attributes and values
                    attrArray.forEach(function(attr){
                        var val = parseFloat(csvRegion[attr]); // get csv attribute value
                        geojsonProps[attr] = val; // assign attribute and value to geojson properties
                    });
                };
            };
        };

        return newZealandRegions;

    }; // end of joinData

    // function updates the domain value depending on the attribute
    function updateDomain(attribute, csvData) {
        expressed = attribute;

        if (expressed == "Seismic Events per 10000 km²") {
            domainHeight = 50;
        } else if (expressed == "Avg. Earthquake Magnitude") {
            domainHeight = 5;
        } else if (expressed == "Avg. Depth of Earthquakes (km)") {
            domainHeight = 105;
        } else if (expressed == "Population Density (km²)") {
            domainHeight = 295;
        } else if (expressed == "Expected Tsunami Height (m/10000km²)") {
            domainHeight = 15;
        };

        // create a new axis generator with the new domain
        var yAxis = d3.axisLeft()
            .scale(yScale.domain([0, domainHeight]));

        // remove the previous axis
        d3.select("g").remove();

        // place new axis
        var axis = chart.append("g")
            .attr("class", "axis")
            .attr("transform", translate)
            .transition()
            .duration(650)
            .call(yAxis);

    };  // close to updateDomain function

    // function to create a dropdown menu for attribute selection
    function createDropdown(csvData){

        // add select element
        var dropdown = d3.select("body")
            .append("select")  // selection option
            .attr("class", "dropdown")
            .on("change", function(){
                changeAttribute(this.value, csvData) // pass changeAttribute the attribute value from csvData
                updateDomain(this.value, csvData) // pass updateDomain the attribute value from csvData

            });

        // add initial option that is disabled
        var titleOption = dropdown.append("option")
            .attr("class", "titleOption")
            .attr("disabled", "true")
            .text("Select Attribute");

        // add attribute name options
        var attrOptions = dropdown.selectAll("attrOptions")
            .data(attrArray)
            .enter()
            .append("option")
            .attr("value", function(d){ return d })
            .text(function(d){ return d });

    };  // close to createDropdown

    // dropdown change listener handler
    function changeAttribute(attribute, csvData){

        // change the expressed attribute
        expressed = attribute;

        // update the domain for the changed attribute
        updateDomain(expressed);

        // recreate the color scale
        var colorScale = makeColorScale(csvData);

        // recolor enumeration units
        var regions = d3.selectAll(".regions")
            .transition() // aniation
            .duration(650) // milliseconds of transition time
            .style("fill", function(d){
                return choropleth(d.properties, colorScale) // style the properties according to the colorScale
            });

        // re-sort bars
        var bars = d3.selectAll(".bar")
            .sort(function(a, b){
                return b[expressed] - a[expressed];  // declining values
            })
            .transition() // add animation
            .delay(function(d, i){
                return i * 75
            })
            .duration(650);

        updateChart(bars, csvData.length, colorScale);

    }; // close to changeAttribute

    // function to position, size, and color bars in chart
    function updateChart(bars, n, colorScale){

        // position bars
        bars.attr("x", function(d, i){
            return i * (chartInnerWidth / n) + leftPadding;
        })
        // size/resize bars
        .attr("height", function(d, i){
            return 463 - yScale(parseFloat(d[expressed]));
        })
        .attr("y", function(d, i){
            return yScale(parseFloat(d[expressed])) + topBottomPadding;
        })
        // color/recolor bars
        .style("fill", function(d){
            return choropleth(d, colorScale);
        });

    }; // close to updateChart

    // function to test for data value and return color
    function choropleth(props, colorScale){

        // make sure attribute value is a number
        var val = parseFloat(props[expressed]);

        // if attribute value exists, assign a color; otherwise assign gray
        if (typeof val == 'number' && !isNaN(val)){
            return colorScale(val);
        } else {
            return "#CCC";
        };
    }; // close to choropleth

    // function to create the map enumeration units
    function setEnumerationUnits(newZealandRegions, map, path, colorScale){

        // add NZ regions to map
        var regions = map.selectAll(".regions")
            .data(newZealandRegions)
            .enter() // for each region that exists
            .append("path")
            .attr("class", function(d){
                // return the region name and replace all of the spaces
                return "regions " + d.properties.Region.replace(/ /g, '');
            })
            .attr("d", path)
            .style("fill", function(d){
                return choropleth(d.properties, colorScale); // color the enumeration unit
            })
            .on("mouseover", function(d){
                highlight(d.properties);  // highlight the area
            })
            .on("mouseout", function(d){
                dehighlight(d.properties); // unhighlight the area
            })
            .on("mousemove", moveLabel); // position a label when moused over

        // cover stroke again as a dehighlight
        var desc = regions.append("desc")
            .text('{"stroke": "#000", "stroke-width": "0.5px"}');

    }; // end of setEnumerationUnits

    //function to create dynamic label
    function setLabel(props){

        // label content
        var labelAttribute = "<h1>" + props[expressed] +
            "</h1><b>" + expressed + "</b>";

        // create info label div
        var infolabel = d3.select("body")
            .append("div")
            .attr("class", "infolabel")
            .attr("id", props.Region + "_label")
            .html(labelAttribute);

        // provide the region name
        var regionName = infolabel.append("div")
            .attr("class", "labelname")
            .html(props.Region);

    }; // close to setLabel

    // function to reset the element style on mouseout
    function dehighlight(props){
        var selected = d3.selectAll("." + props.Region.replace(/ /g, '')) // replace all of the spaces
            .style("stroke", function(){
                return getStyle(this, "stroke")
            })
            .style("stroke-width", function(){
                return getStyle(this, "stroke-width")
            });

        // function to retrieve the label style
        function getStyle(element, styleName){
            var styleText = d3.select(element)
                .select("desc")
                .text();

            var styleObject = JSON.parse(styleText);

            return styleObject[styleName];

        }; // close to getStyle

        // remove the label
        d3.select(".infolabel")
            .remove();

    }; // close to dehighlight

    // function to reposition the label
    function moveLabel(){

        // get width of label
        var labelWidth = d3.select(".infolabel")
            .node()
            .getBoundingClientRect()
            .width;

        // use coordinates of mousemove event to set label coordinates
        var x1 = d3.event.clientX + 10,
            y1 = d3.event.clientY - 75,
            x2 = d3.event.clientX - labelWidth - 10,
            y2 = d3.event.clientY + 25;

        // horizontal label coordinate, testing for overflow
        var x = d3.event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1;

        // vertical label coordinate, testing for overflow
        var y = d3.event.clientY < 75 ? y2 : y1;

        d3.select(".infolabel")
            .style("left", x + "px")
            .style("top", y + "px");

    }; // close to moveLabel


    // function to highlight enumeration units and bars
    function highlight(props){

        // change stroke
        var selected = d3.selectAll("." + props.Region.replace(/ /g, ''))
            .style("stroke", "Black")
            .style("stroke-width", "2");

        setLabel(props);
    };


    // function to create color scale generator
    function makeColorScale(data) {

        // array to hold sequential color scheme
        var colorClasses = [
            "#FFFFB2",
            "#FECC5C",
            "#FD8D3C",
            "#F03B20",
            "#BD0026"
        ];

        // create color scale generator
        var colorScale = d3.scaleThreshold()
            .range(colorClasses);

        // build array of all values of the expressed attribute
        var domainArray = [];
            for (var i = 0; i < data.length; i++){
                var val = parseFloat(data[i][expressed]);
                domainArray.push(val);
            };

        // cluster data using ckmeans clustering algorithm to create natural breaks
        var clusters = ss.ckmeans(domainArray, 5);

        // reset domain array to cluster minimums
        domainArray = clusters.map(function(d){
            return d3.min(d);
        });

        // remove first value from domain array to create class breakpoints
        domainArray.shift();

        // assign array of last 4 cluster minimums as domain
        colorScale.domain(domainArray);

        return colorScale;

    }; // end of makeColorScale

})(); //last line of main.js
