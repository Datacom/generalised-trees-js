var columns = {}
var uses = {}
var set
var prune =0.7
var treeSVG //= false

var slider = new Slider('#prune', {
	formatter: function(value) {
		return 'Current value: ' + value;
	}
})

slider.on('slideStop', function(prune){makeTreeNow(set,columns,prune)})

d3.queue()
    .defer(d3.json, 'http://172.17.157.164:8000/datasets')
    .await(setChooser);

function setChooser(err,_setList){

  
  setList = _.sortBy(_setList, function(d){return d.Dataset.toLowerCase()})
  var options = d3.select('#setChoice')
    .on("change", getSetFeatures)  
    .selectAll("option.real")
    .data(setList)
    .enter()
    .append('option')
    .text(function(d){return d.Dataset})
}

function getSetFeatures(){
  d3.selectAll('option.fake').remove()
//  d3.selectAll('svg').remove()
//  treeSVG = false
  set = this.selectedOptions[0].__data__
  var setString = 'http://172.17.157.164:8000/datasets/'+set.Package+'/'+set.Dataset
  d3.select("#package").text('Package: '+ set.Package)
  d3.select("#rows").text(set.Rows+' rows')
  d3.select("#title").text(set.Title)
  
  d3.queue()
    .defer(d3.json, setString)
    .await(paramsChooser);  
}

function paramsChooser(err, _columns){
  columns = {}
  _.map(_columns.columns,function(v,k){
    columns[k] = {column:k, 
                  type: v, 
                  sample: _.pluck(_columns.sample,k),
                  use: 'unused'
           }
  })
  
  d3.select('tbody').selectAll('tr').remove()
  tableRows = d3.select('tbody')
    .selectAll('tr')
    .data(_.values(columns))
    .enter()
    .append('tr').each(makeTableRow)
   d3.select('#featureTable').classed('hide',false)
   d3.select('#treediv').classed('hide',true)
  
}

function makeTableRow(d){
 
  var row = d3.select(this)
  row.append('td').text(d.column)
  row.append('td').text(d.type)
  row.append('td').text(d.sample.join(', '))
  row.append('td')
    .append('select').classed("form-control",true)
    .on("change", function(d){   
      columns[d.column].use = this.selectedOptions[0].__data__.str
    })
    .selectAll('option')
    .data([
      {text:'unused', str:'unused'},
      {text:'label', str:'label'},
      {text:'frequency', str:'freq'},
      {text:'feature', str:'features'},
      {text: 'ordinal feature', str:'ords'}
       ])
    .enter().append('option').text(function(d){return d.text})    
}


function dataCall(set,columns,prune){
  if (_.isUndefined(set)){return 'http://172.17.157.164:8000/dataset/datasets/Titanic?freq=Freq&label=Survived&features=Sex,Age&ords=Class&prune='+prune}
  uses = _.groupBy(columns,function(d){return d.use})
  delete uses.unused
  var str =_.map(uses, function(v,k){return k+'='+_.pluck(v,'column').join(',')}).join('&')
  return 'http://172.17.157.164:8000/dataset/'+set.Package+'/'+set.Dataset+'?'+str+'&prune='+prune
}

function makeTreeNow(set,columns,prune){
  d3.select('#featureTable').classed('hide',true)
  d3.select('#treediv').classed('hide',false)
  d3.queue()
      .defer(d3.json, dataCall(set,columns,prune))
      .await(maketree);
}

d3.select('#makeatree').classed('disabled',false).on('click',function(){makeTreeNow(set,columns,prune)})

function initialiseTree(height,width){
  var g = d3.select("#treediv").append("svg")
  .attr("width",width+50)
  .attr("height", height+200)
  .append("g")
  .attr("transform", "translate(50,100)");
  return g
}

function maketree(err, _treeData){
treeData=[_treeData]
height = 600
width = d3.select('#treediv').node().getBoundingClientRect().width - 50
barwidth = 70
bararea = 1000
barscale = d3.scaleLinear().range([0,barwidth])
heightscale = d3.scaleLinear().range([0,70])
colorscale = d3.scaleOrdinal(d3.schemeCategory10)


if (_.isUndefined(treeSVG)){treeSVG = initialiseTree(height,width)}

tree = d3.tree()
	.size([width,height]);

root = d3.hierarchy(treeData[0]);
  
root.x0 = width/2;
root.y0 = 0;

barscale.domain([0,1])  
heightscale.domain([0,_.values(treeData[0].counts).reduce(function(a,b){return a+b})])   

var link = treeSVG.selectAll("path.link")
    .data(tree(root).descendants().slice(1), function(d){return d.data.path})
    
  link.enter().append("path").attr("class", "link")

  link.exit().remove()

  d3.selectAll("path.link").transition()
          .attr("d", function(d) {
          return "M" + d.x + "," + d.y
              + "C" + d.x + "," + (d.y + d.parent.y) / 2
              + " " + d.parent.x + "," + (d.y + d.parent.y) / 2
              + " " + d.parent.x + "," + d.parent.y;
        });
  

  
  var node = treeSVG.selectAll(".node")
    .data(root.descendants(), function(d){return d.data.path})
    
 var newnodes = node.enter().append("g")
    .attr("class","node") .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; })
    .attr('opacity',.5)
//    .append("circle")
//    .attr("r", 2.5)
    
  newnodes.append('text')
    .attr('text-anchor','middle').text(function(d){
        return d.depth == 0 ? 'Overall':''
      }); 
  
//  node.exit().transition("exitTransition").attr('opacity',0).remove()
  node.exit().remove()
  
  node.merge(newnodes).transition("enter")
    .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; }).attr('opacity',1)
 
   
  
  leaf = d3.selectAll("g.node")
  
  leafRects = leaf.selectAll("rect").data(function(d){
     var start = 0
     var data = []
     var total = _.values(d.data.counts).reduce(function(a,b){return a+b})
     for (key in d.data.counts){ 
       data.push({name:key,value:d.data.counts[key],start:start,total:total})
       start = start + d.data.counts[key]
     }
    return data},function(n){return n.name})
   
  leafRects.enter().append('rect')
  leafRects.exit().remove()
  
  leaf.selectAll("rect")
    .attr("transform",function(d){
      var thisBarheight = d.total
      return "translate("+(-1*(barwidth/2)+barscale(d.start/d.total))+","+(-1*heightscale(thisBarheight)/2)+")"
    })
      .attr("width",function(d){    
      return barscale(d.value/d.total)
    })
    .attr("height",function(d){
      var thisBarheight = d.total
      return Math.max(heightscale(thisBarheight),1)
    })
    .attr('fill',function(d){return colorscale(d.name)})
    .append("title")
        .text(function(d){return uses.label[0].column+': '+d.name+", "+d.value});

  leaf.select("text")
    .text(function(d){
    if (d.parent && d.parent.data){  
      if (_.isBoolean(d.parent.data.value)){
          if (d.data.which =="gte" && d.parent.data.value){return d.parent.data.feature.replace(': ',' is ') }
          if (d.data.which =="gte" && !d.parent.data.value){return d.parent.data.feature.replace(': ',' is not ') }
          if (d.data.which =="lt" && d.parent.data.value){return d.parent.data.feature.replace(': ',' is not ') }
          if (d.data.which =="lt" && !d.parent.data.value){return d.parent.data.feature.replace(': ',' is ') }
          }
            
      if(isNaN(+d.parent.data.value) && d.data.which =="lt"){join = 'is not'}
      else
      if(isNaN(+d.parent.data.value) && d.data.which =="gte"){join = 'is'}
      else 
      if(d.data.which =="lt"){join = '<'}
      else{join = "≥"}
      return d.parent.data.feature+" "+join+" "+d.parent.data.value }
    return 'Overall'
    })
    .attr("transform", function(d){
      var thisBarheight = _.values(d.data.counts).reduce(function(a,b){return a+b})
      return "translate(0,"+((-1*heightscale(thisBarheight)/2)-3)+")"})
    .attr('text-anchor','middle')
}
  