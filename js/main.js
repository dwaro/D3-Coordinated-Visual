/* Jacob Waro js for D3, Spring 2017 */

//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){
    //map frame dimensions
    var width = 960,
        height = 460;

    //create new svg container for the map
    var map = d3.select("body")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);

    //create Albers equal area conic projection centered on France
    var projection = d3.geoAlbers()
        .center([0, -40.7])
        .rotate([-172, 0, 0])
        .parallels([-38.5, -44.5])
        .scale(1791)
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
        //create graticule generator
        var graticule = d3.geoGraticule()
            .step([5, 5]); //place graticule lines every 5 degrees of longitude and latitude

        //create graticule background
        var gratBackground = map.append("path")
            .datum(graticule.outline()) //bind graticule background
            .attr("class", "gratBackground") //assign class for styling
            .attr("d", path) //project graticule

        //create graticule lines
        var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
            .data(graticule.lines()) //bind graticule lines to each element to be created
            .enter() //create an element for each datum
            .append("path") //append each element to the svg as a path element
            .attr("class", "gratLines") //assign class for styling
            .attr("d", path); //project graticule lines

        //translate NZ TopoJSON
        var newZealandRegions = topojson.feature(nz, nz.objects.NZ_Boundaries).features;

        //add France regions to map
        var regions = map.selectAll(".regions")
            .data(newZealandRegions)
            .enter()
            .append("path")
            .attr("class", function(d){
                return "regions " + d.properties.region;
            })
            .attr("d", path);

        //examine the results
        console.log(newZealandRegions);
    };

};
