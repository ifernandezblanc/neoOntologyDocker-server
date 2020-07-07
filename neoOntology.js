/*======================================================================================================================
Author: Iñigo Fernandez del Amo - 2019
Email: inigofernandezdelamo@outlook.com
License: This code has been developed for research and demonstration purposes.
Copyright (c) 2019 Iñigo Fernandez del Amo. All Rights Reserved.
Copyright (c) 2019 Cranfield University. All Rights Reserved.
Copyright (c) 2019 Babcock International Group. All Rights Reserved.
All Rights Reserved.
Confidential and Proprietary - Protected under copyright and other laws.
Date: 07/08/2019
======================================================================================================================*/

/*======================================================================================================================
Description:
neoOntology is an ontology-based maintenance data server and inference engine.
An ontology-elements and files server to feed data into rtrbau applications.
Usage and links:
File creation: dependencies created manually in json file according to: https://www.youtube.com/watch?v=snjnJCZhXUM
File storage: using multer storage engine according to: https://github.com/expressjs/multer/blob/master/StorageEngine.md
Server setup: neo4j-driver for nodejs and neo4j; requires v1 according to: https://neo4j.com/developer/javascript/
Query structure: uses cypher language and neosemantics notation for database query
Comments: code notes can be theoretical (THE), implementation (IMP) and error handling (ERR) descriptors.
Comments: code notes also declare potential upgrades (UPG) and maintainability (MAN) issues.
======================================================================================================================*/

/*======================================================================================================================
Structure:
1. Namespaces
2. Middleware setup
3. neoOntology
    3.1. Members
    3.2. Methods
    3.3. HTTP GET requests: {ping, files, json, view}
    3.4. HTTP POST requests: {files, json} (view)
    3.5. HTTP PUT requests
    3.6. HTTP DELETE requests
4. neoOntologyCM
5. neoOntologyAR
6. Port management
7. App export
======================================================================================================================*/

/*====================================================================================================================*/
// 1. NAMESPACES
/*====================================================================================================================*/
/*====================================================================================================================*/
// A. NodeJS Modules:
/*====================================================================================================================*/
// 1. To read files and directories
const fs = require('fs');
// 2. To work with file and directory paths
const path = require('path');
/*====================================================================================================================*/
// B. Third-party Modules:
/*====================================================================================================================*/
// 1. To code web applications (http requests)
const express = require('express');
// 2. To log sever usage and console messages
const morgan = require ('morgan');
// 3. To parse and handle errors in data before use
const bodyParser = require('body-parser');
// 4. To connect to neo4j graphical databases
const neo4j = require('neo4j-driver').v1;
// const neo4j = require('neo4j-driver');
// 5. To enable files upload
const multer = require('multer');
// 6. To enable favicon request
const favicon = require('serve-favicon');
// 7. To enable console debugging
const util = require('util');
/*====================================================================================================================*/

/*====================================================================================================================*/
// 2. MIDDLEWARE SETUP
/*====================================================================================================================*/
/*====================================================================================================================*/
// A. Express initialisation
/*====================================================================================================================*/
// Instantiate web application framework (express)
const app = express();
// Setup ejs as engine view for dynamic files
app.set('view engine', 'ejs');
// Setup directory for ejs rendering files
app.set('views', path.join(__dirname,'assets','views'));
// Setup directory for file sharing (includes folder for user files storage)
app.use(express.static(path.join(__dirname,'assets')));
// Setup logger method
app.use(morgan('dev'));
// Setup body parsing method (standard)
app.use(bodyParser.json());
//app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.urlencoded({extended:true}));
// Setup favicon icon request
app.use(favicon(path.join(__dirname,'assets','favicon.ico')));
/*====================================================================================================================*/
// B. Database driver initialisation (neo4j)
/*====================================================================================================================*/
// Declare route to neo4j server
const driver = neo4j.driver('bolt://host.docker.internal', neo4j.auth.basic('neo4j','opexcellence'));
// const driver = neo4j.driver('neo4j://localhost', neo4j.auth.basic('neo4j', 'neo4j'));
// Instantiate connection to neo4j server
let session = driver.session();
/*====================================================================================================================*/
// C. File uploader initialisation (multer)
/*====================================================================================================================*/
// Instantiate file storage engine
// UPG: to manage multiple versions of same file
const storage = multer.diskStorage({
    destination: function(req, file, cb) { cb(null, path.join(__dirname, 'assets', 'files', req.params.fileType)); },
    filename: function(req, file, cb) { cb(null, file.originalname);}
});
// Instantiate upload engine
// IMP: enables single-file POST request using form-data bodies with key 'file'
// UPG: to enable multiple file upload
const upload = multer({
    storage: storage,
    fileFilter: function(req, file, cb) {
        // Accept existing file types only
        // UPG: to dynamically find available file types and return
        if (!file.originalname.match(/\.(jpg|png|wav|mp4|obj|owl|dat|xml)$/)) {
            req.fileValidationError = 'File type is not allowed';
            return cb(new Error('File type is not allowed'), false);
        }
        else if (!path.extname(file.originalname).match(req.params.fileType)) {
            req.fileValidationError = 'File type does not match url';
            return cb(new Error('File type does not match url'), false);
        }
        cb(null, true);
    }
}).single('file');
/*====================================================================================================================*/


/*====================================================================================================================*/
// 3. NEOONTOLOGY
// Ontology-based data transfer services and visualisation
/*====================================================================================================================*/
/*====================================================================================================================*/
// 3.1. MODULE MEMBERS
/*====================================================================================================================*/
/*====================================================================================================================*/
// A. Environmental variables:
/*====================================================================================================================*/
// Listening port
// IMP: for raspberry pi to have a specific port in case environmental variable not implemented
// UPG: to add environmental variable for server machine to move port for listening
const port = process.env.PORT || 3003;
// B. Ontologies variables:
// UPG: to re-write server considering non-proprietary ontologies and read ontologies available from neo4j database
// Proprietary ontology http address
// IMP: to consider that only ontologies declared in the server are available
const neontURL = "http://138.250.108.1:3003/api/files/owl/";
// Non-proprietary ontologies http addresses
// IMP: to manage non-proprietary ontologies required for rdfs reasoning
const owlURL = "http://www.w3.org/2002/07/owl";
const xsdURL = "http://www.w3.org/2001/XMLSchema";
// Disabled prefixes
// IMP: to manage non-used ontology prefixes declared in neo4j
const ontologiesDisabled = ['xml','rdf','rdfs','owl','xsd','sch','dc','dct','skos','sh'];
/*====================================================================================================================*/

/*====================================================================================================================*/
// 3.2. MODULE METHODS
// UPG: to export as middleware when number of functions becomes considerable
/*====================================================================================================================*/
/*====================================================================================================================*/
// A. Parsing
/*====================================================================================================================*/
// File directories parsing
// IMP: to obtain file types available to work with files for sharing
function returnFilesAvailable(dirname,filename) {
    // Returns true if filename can be found in dirname directory
    let filesAvailable = fs.readdirSync(dirname);
    // Avoids 'hidden' directories '.'
    filesAvailable = filesAvailable.filter(item => !(/(^|\/)\.[^\/\.]/g).test(item));
    return filesAvailable.includes(filename);
}
/*====================================================================================================================*/
// B. Names
/*====================================================================================================================*/
// Return Ontology Entity's name from uri
// UPG: to serve uri prefix and name as independent variables for managing
// IMP: splits uri as it considers all prefixes are the same "ontologiesURI" and returns name
function returnUriElement(uri) {
    // For parsing uri elements generically
    // If not null
    if (uri != null) {
        // Returns element name splitted from uri after "#"
        return uri.split("#")[1];
    } else {
        // Otherwise returns null
        return null;
    }
}
// Return Ontology Entity's Ontology from uri
// IMP: splits uri and returns ontology name
function returnUriOntology(uri) {
    // For parsing uri elements generically
    // If not null
    if (uri != null) {
        // Returns element ontology splitted from uri before "#" and after last "/"
        return uri.split("/").pop().split("#")[0];
    } else {
        // Otherwise return null
        return null;
    }
}
// Return neo4j-neosemantics notation from ontology entity's ontology and name
// UPG: to serve uri prefix and name as independent variables for managing
function returnNeo4jNameElement(prefix, element) {
    // For parsing prefixed names in neo4j
    // If not null
    if (element.includes("__") === true && element.split("__")[0] === prefix) {
        // Retrieves element name that matches the ontology prefix
        return element.split("__")[1];
    } else {
        // Otherwise returns null
        return null;
    }
}
// Return ontology entity's uri from neo4j-neosemantics notation
// UPG: to manage all neo4j implemented ontologies independently
function returnURIfromNeo4jElement(element) {
    // Parses name in neo4j finds relevant url and return uri element
    // If element is from owl applies owlURL otherwise applies proprietary url
    if (element.includes("__") === true && element.split("__")[0] === 'owl') {
        // Retrieves element name that matches the ontology prefix
        return owlURL + "#" + element.split("__")[1];
    } else if (element.includes("__") === true && element.split("__")[0] !== 'owl') {
        // Otherwise returns null
        return neontURL + element.split("__")[0] + "#" + element.split("__")[1];
    } else {
        // Otherwise returns null
        return null;
    }
}
// Return ontology entity's uri from ontology's and entity's names
// UPG: to work with non-proprietary ontologies
function constructURI(prefix,name) {
    // Concatenates ontological names to create the uri resource
    return neontURL + prefix + "#" + name;
}
// Return new individual uri given class and ontology names
function constructNewIndividualURI(ontologyName,className) {
    // "yyyy'-'MM'-'dd'T'HH'-'mm'-'ss''zz"
    let now = new Date();
    let date = now.getFullYear()+'-'+(now.getMonth()+1)+'-'+now.getDate();
    let time = now.getHours()+'-'+now.getMinutes()+'-'+now.getSeconds()+(now.getTimezoneOffset()/60);
    return neontURL + ontologyName + "#" + className + "_" + date + "T" + time;
}
/*====================================================================================================================*/
// C. Ontologies query
// THE: uses rdfs to identify all possible inferences that can be done for an ontology, class, individual or property
// IMP: returns ontology entities in json format for rtrbau and ejs files http requests
// IMP: evaluations all return same json object {success/error/warning:{level:,name:,evaluation:,value:}}
// IMP: consider input individual in json format: {name:,class:,ontology:,properties:[{name:,value:,domain:,range:}]}
// IMP: non-evaluation functions may consider different json formats
// UPG: to include also reasoning about properties {datatype,object}
// UPG: to extend from rdfs to owl (REQUIRES of upgrading neosemantics)
/*====================================================================================================================*/
// C.1. Ontology level
// Ontologies: return proprietary ontologies available in neo4j graph database
// THE: rdf:RDF | to consult what knowledge domains can be queried
// IMP: returns prefixes and names in json format
let ontologies = function () {
    return new Promise (function (resolve, reject) {
        // Variable to capture parts of message being read in loop
        let ontologies = [];
        // neo4j query session: uses cypher language to consult graphical database
        session
        // returns namespaces prefixes according to neosemantics declaration
            .run(`MATCH (n:NamespacePrefixDefinition) RETURN properties(n)`)
            .then(function(result){
                // Review each record sent by neo4j
                result.records.forEach(function(record) {
                    // Variable to get keys from specific json object
                    let ontologiesKeys = Object.keys(record._fields[0]);
                    // For each loop over json keys to access json object indirectly
                    ontologiesKeys.forEach(function(ontologyKey) {
                        // Process key to check if it is a common ontology to avoid
                        if (ontologiesDisabled.includes(record._fields[0][ontologyKey]) !== true){
                            // Obtain elements from neo4j record and pass them over sending message
                            ontologies.push({
                                ontPrefix: record._fields[0][ontologyKey],
                                ontUri: ontologyKey
                            });
                        } else {}
                    });
                });
                // All to be sent through json objects
                resolve({ontOntologies: ontologies});
            })
            // Handles neo4j errors
            .catch(function(error) {
                reject(error);
            });
    });
};
// Ontology name correctness: to evaluate the correctness of the individual being instantiated
// IMP: compares the ontology name given by the post body and the post request parameters
let ontologyNameCorrectness = function(individual, ontologyName) {
    return new Promise(function(resolve){
        const uriElement = neontURL + ontologyName + "#";
        if (individual["ontOntology"]===uriElement){
            resolve ({ontSuccess:{ontLevel:"individual",ontName:individual["ontName"],
                    ontEvaluation:"ontologyCorrectness",ontValue:individual["ontOntology"]}});
        } else {
            resolve ({ontError:{ontLevel:"individual",ontName:individual["ontName"],
                    ontEvaluation:"ontologyCorrectness",ontValue:individual["ontOntology"]}});
        }
    });
};
/*====================================================================================================================*/
// C.2. Class level
// Class existence evaluation: returns existence of class being instantiated
let classExistence = function(individual) {
    return new Promise(function(resolve, reject) {
        session
        // Matches the existence of the class by URI
            .run(`MATCH (n{uri:"${individual["ontClass"]}"}) RETURN n`)
            .then(function(results) {
                if (results.records.length !== 0) {
                    resolve ({ontSuccess:{ontLevel:"individual",ontName:individual["ontName"],
                            ontEvaluation:"classExistence",ontValue:individual["ontClass"]}});
                } else {
                    resolve ({ontError:{ontLevel:"individual",ontName:individual["ontName"],
                            ontEvaluation:"classExistence",ontValue:individual["ontClass"]}});
                }
            })
            .catch(function(error){
                reject(error);
            });
    });
};
// Class subclasses: returns the classes that are subclasses of a given class
// THE: rdfs:subClassOf | to navigate through ontology classes
// IMP: ontology policy development ensures all classes belong to the namespace class
// IMP: given an ontology and a class name, returns subclasses in json format
// UPG: rdfs:subPropertyOf | to extend queries to subProperties
// UPG: to manage ontology prefixes, maybe update ontologiesURI to a function to retrieve prefix?
// UPG: that will require to maintain a list of available prefixes similar to the one in neo4j node, maybe consult?
let classSubclasses = function(uri) {
  return new Promise(function(resolve, reject) {
      // Variable to capture subclasses names
      let subclassesArray = [];
      session
      // Matches owl__Class nodes by uri and return other owl__Class nodes through rdfs__subClassOf relationships
          .run(`MATCH (a:owl__Class{uri:"${uri}"})<-[r:rdfs__subClassOf]-(b:owl__Class) 
          RETURN a.uri, b.uri`)
          .then(function(result){
              // Evaluates if the server contains nodes that match the uri
              if (result.records.length !== 0) {
                  // Captures each subclass name from results retrieved from neo4j
                  result.records.forEach(function(record){
                      subclassesArray.push({ontSubclass: record._fields[1]});
                  });
                  // Formats results in a json object
                  resolve({ontClass: uri, ontSubclasses: subclassesArray});
              } else {
                  // Otherwise sends an error
                  //resolve({ontError:"Subclasses not found"});
                  resolve({ontClass: uri, ontSubclasses: []});
              }
          })
          .catch(function(error){
              reject(error);
          });
  });
};
// Class example: returns the class individual with the most number of relationships
// IMP: it assumes datatype properties will always be the same for a given class (due to rdfs nomenclature)
// UPG: to recommend individuals from a specific class, given contextual parameters
// Promise to identify individual name
let classExample = function (uri) {
    let ontologyName = returnUriOntology(uri);
    let className = returnUriElement(uri);
    return new Promise(function(resolve, reject) {
        session
        // Matches nodes with owl__NamedIndividual and ontology__class labels
        // and returns the one with the most relationships
            .run(`MATCH (n)-[r]-() WHERE n:owl__NamedIndividual AND n:${ontologyName}__${className} 
                RETURN n.uri, count(r) ORDER BY count(r) DESC LIMIT 1`)
            .then(function(result){
                // Evaluates if the server contains nodes that match the class
                if (result.records.length !== 0) {
                    // Captures individual uri retrieved by neo4j
                    result.records.forEach(function(record){
                        resolve(record._fields[0]);
                    });
                } else {
                    // Otherwise sends an error
                    reject({ontError:"Individuals not found"});
                }
            })
            .catch(function(err){
                reject(err);
            });
    });
};
// Class individuals: returns the individuals that belong to a given class
// THE: owl:NamedIndividual | to identify individuals instantiated to a class
// IMP: uses neosemantics notation (ontology__element) to identify a class
// IMP: given an ontology and a class name, returns its individuals in json format
// UPG: to extend identification of class and individuals that may be replicated in other ontologies
let classIndividuals = function(uri) {
  return new Promise(function(resolve,reject) {
      let ontologyName = returnUriOntology(uri);
      let className = returnUriElement(uri);
      // Variable to identify individuals names
      let individualsArray = [];
      session
      // Matches nodes with owl__NamedIndividual and ontology__class labels to retrieve class individuals
          .run(`MATCH (n) WHERE n:owl__NamedIndividual AND n:${ontologyName}__${className} RETURN n.uri`)
          .then(function(result){
              // Evaluates if the server contains nodes that match the class
              if (result.records.length !== 0) {
                  // Captures individual names retrieved by neo4j
                  result.records.forEach(function(record){
                      individualsArray.push({ontIndividual: record._fields[0]});
                  });
                  // Returns individuals names of class name in json format
                  resolve({ontClass: uri, ontIndividuals: individualsArray});
              } else {
                  // Otherwise sends an error
                  // resolve({ontError:"Individuals not found"});
                  resolve({ontClass: uri, ontIndividuals: []});
              }
          })
          .catch(function(err){
              reject(err);
          });
  });
};
// Class properties: returns the properties (attributes and relationships) that define a given class
// THE: rdfs:domain, rdfs:range, owl:datatypeProperty, owl:objectProperty
// THE: to identify how to instantiate an individual to a class
// IMP: given a class name, returns properties in json format
// IMP: returns empty properties if do not exist
// UPG: to extend class declaration with owl language elements (e.g. owl:cardinality, owl:functionality, etc.)
// UPG: to use owl elements to infer all class superclasses to identify instantiation properties for an individual
let classProperties = function(uri) {
  return new Promise(function(resolve, reject) {
      session
      // Matches owl__Class nodes with owl__ObjectProperty and owl__DatatypeProperty nodes
      // and with other class nodes by rdfs:domain and rdfs:range
          .run(`MATCH (a:owl__Class{uri:"${uri}"}) OPTIONAL MATCH (a)<-[r:rdfs__domain]-(b)-[s:rdfs__range]->(c) 
          WHERE b:owl__ObjectProperty OR b:owl__DatatypeProperty RETURN a.uri,labels(b),b.uri,c.uri`)
          .then(function(result){
              // Evaluates if the server contains nodes that match the class
              if (result.records.length !== 0) {
                  // Evaluates if class has properties assigned
                  if (result.records[0]._fields[1] !== null) {
                      let propertyTypesArray = [];
                      let propertiesArray = [];
                      // Returns the rdfs and owl types of a given property
                      result.records.forEach(function(record){
                          record._fields[1].forEach(function(type){
                              if(returnNeo4jNameElement('owl',type) !== null ) {
                                  propertyTypesArray.push(returnURIfromNeo4jElement(type));
                              } else {}
                          });
                          // Captures additional property data in json format
                          propertiesArray.push({
                              // UPG: to ensure only one property type is found propertyTypesArray[0]
                              ontName: record._fields[2],
                              ontRange: record._fields[3],
                              ontType: propertyTypesArray[0]
                          });
                          // Regenerate propertyTypesArray for new property to be pushed into the array
                          propertyTypesArray = [];
                      });
                      // Returns class and properties in json format
                      resolve({ontClass: uri, ontProperties: propertiesArray});
                  } else {
                      // Otherwise returns a class with empty properties
                      resolve({ontClass: uri, ontProperties: []});
                  }

              } else {
                  // Otherwise sends an error
                  resolve({ontError:"Class not found"});
              }
          })
          .catch(function(err){
              reject(err);
          });
  });
};
// Class properties lack: returns warnings about class properties not being instantiated by the individual
// THE: owl:Cardinality | to evaluate if class properties are missing in individual instantiation
// THE: antagonist evaluation of domain correctness at individual level (missing <-> extra)
// IMP: does not resolve errors, only warnings on missing properties
// UPG: to extend to error resolve using owl rules (e.g. owl:cardinality)
let classPropertiesLack = function(individual) {
    return new Promise(function(resolve, reject) {
        session
        // Matches properties declared for the class
            .run(`MATCH (a:owl__Class{uri:"${individual["ontClass"]}"})<-[r:rdfs__domain]-(b) 
            WHERE b:owl__ObjectProperty OR b:owl__DatatypeProperty RETURN a.uri,b.uri`)
            .then(function(results) {
                // Variables to manage individual and class properties names
                let individualPropertiesNames = [];
                let classPropertiesNames = [];
                // Returns individual properties names
                individual["ontProperties"].forEach(
                    function(individualProperty){individualPropertiesNames.push(individualProperty["ontName"])});
                // Returns class properties names
                results.records.forEach(function(record){classPropertiesNames.push(record._fields[1])});
                // Filters class properties missing at individual declaration
                let missingPropertiesNames = classPropertiesNames.filter(
                    function(propertyName){return !individualPropertiesNames.includes(propertyName)});
                // Resolves a warning with missing properties for the individual
                resolve ({ontWarning:{ontLevel:"individual",ontName:individual["ontName"],
                        ontEvaluation:"propertiesLack",ontValue:missingPropertiesNames}})
            })
            .catch(function(error){
                reject(error);
            });
    });
};
// Class distance: returns minimum graph distance between two given classes
// THE: owl:ObjectProperty | to identify relationships between two classes and calculate their distance
// IMP: uses neosemantics notation (ontology__element) to identify classes and object properties
// IMP: assumes all object properties considered belong to a specific ontology
// UPG: to extend to different type of distances being calculated
let classDistance = function(ontologyStartName, classStartName, ontologyDistanceName, ontologyEndName, classEndName) {
  return new Promise(function(resolve,reject) {
      // Check the cases when classes are equal and distance should be zero.
      if (ontologyStartName === ontologyEndName && classStartName === classEndName) {
          // Builds uri resources for classes constructed
          let classStartURI = constructURI(ontologyStartName, classStartName);
          let classEndURI = constructURI(ontologyEndName, classEndName);
          // Builds json object to send distance between two classes
          resolve({ontStartClass: classStartURI, ontEndClass: classEndURI, ontDistance: "0"});
      }
      else {
          session
          // Matches all individual nodes instantiated by the given classes
          // Return the minimum length of the shortest paths found between those two sets of nodes
              .run(`MATCH (a:${ontologyStartName}__${classStartName}),
        (b:${ontologyEndName}__${classEndName}),p = shortestPath((a)-[*]-(b)) 
        WHERE ALL (r in relationships(p) WHERE type(r) STARTS WITH "${ontologyDistanceName}")
        RETURN min(length(p))`)
              .then(function(result){
                  // Evaluates if query result is null
                  if (result.records[0]._fields[0] !== null) {
                      // Builds uri resources for classes constructed
                      let classStartURI = constructURI(ontologyStartName, classStartName);
                      let classEndURI = constructURI(ontologyEndName, classEndName);
                      // Parses number retrieved from neo4j to string
                      let classesDistance = result.records[0]._fields[0].low.toString();
                      // Builds json object to send distance between two classes
                      resolve({
                          ontStartClass: classStartURI,
                          ontEndClass: classEndURI,
                          ontDistance: classesDistance});
                  } else {
                      // Otherwise sends an error
                      resolve({ontError:"Distance not found"});
                  }

              })
              .catch(function(err){
                  reject(err);
              });
      }
  });
};
/*====================================================================================================================*/
// C.3. Individual level
// Individual properties: returns the attributes and relationships of a given individual in an ontology
// THE: owl:NamedIndividual | to identify an individual by the properties and values used to declare it
// IMP: given an ontology and an individual name, returns its properties in json format
// IMP: returns empty properties if do not exist
// IMP: evaluates datatype (properties) and object (relationship) properties using neosemantics notation
// UPG: to extent evaluation of properties being declared by other ontologies
// UPG: to extend property declaration including domain and range of each property returned
// UPG: to extend evaluation of properties retrieved by the ontology being consulted (ontology__Property)
let individualProperties = function(uri) {
    return new Promise(function(resolve,reject) {
        let ontologyName = returnUriOntology(uri);
        let className = returnUriElement(uri);
        // Variables to capture elements independently due to the message structure retrieved by the cypher query
        let classArray;
        // Object properties are stored differently than data properties as they require different capture methods
        let dataPropertiesArray = [];
        let objectPropertiesArray = [];
        session
        // Matches node by uri and owl__NamedIndividual label
        // and returns classes (labels), and datatype (properties) and object (relations{type}) properties
            .run(`MATCH (a:owl__NamedIndividual{uri:"${uri}"}) 
            OPTIONAL MATCH (a)-[r]->(b) RETURN a.uri, labels(a), properties(a), type(r), b.uri`)
            .then(function(result){
                // Evaluates if the server contains nodes that match the class
                if (result.records.length !== 0) {
                    // Evaluates neo4j results using their array indexes
                    result.records.forEach(function(record, index, array){
                        // Some fields in each record include repeated data, these need pre-processing
                        // Pre-processing is not elegant as it repeats the same operation more than needed
                        // Conditional clause included to avoid replication, only get results from first record
                        if (Object.is(array.length - 1, index)) {
                            // Returns class name only from first property as it is always the same
                            record._fields[1].forEach(function(label) {
                                if (returnNeo4jNameElement(ontologyName, label) !== null) {
                                    classArray = returnURIfromNeo4jElement(label);
                                } else {}
                            });
                            // Returns datatype property name and value for each property retrieved by neo4j
                            let dataPropertiesKeys = Object.keys(record._fields[2]);
                            dataPropertiesKeys.forEach(function(dataPropertyKey){
                                // Considers the case where data properties are null
                                // Avoids data properties which do not belong to the ontology being queried
                                if(returnNeo4jNameElement(ontologyName,dataPropertyKey) !== null) {
                                    dataPropertiesArray.push({
                                        ontName: returnURIfromNeo4jElement(dataPropertyKey),
                                        ontValue: record._fields[2][dataPropertyKey],
                                        ontType: owlURL + "#" + "DatatypeProperty"
                                    });
                                } else {}
                            });
                        }
                        // Returns object property name and value for each property retrieved by neo4j
                        // Considers the case where object properties are null
                        if (record._fields[3] !== null ) {
                            objectPropertiesArray.push({
                                ontName: returnURIfromNeo4jElement(record._fields[3]),
                                ontValue: (record._fields[4]),
                                ontType: owlURL + "#" + "ObjectProperty"
                            });
                        } else {}
                    });
                    // Returns individual name, class name, and properties name, value and type in json format
                    resolve({
                        ontIndividual: uri,
                        ontClass: classArray,
                        ontProperties: dataPropertiesArray.concat(objectPropertiesArray)});
                } else {
                    // Otherwise sends an error
                    resolve({ontError:"Individual not found"});
                }
            })
            .catch(function(err){
                reject(err);
            });
    });
};
// Individual last: returns the latest (time-wise) value for a given individual from a class related to another
// IMP: special ontology inferencing call
// IMP: SPARQL query for ontologyCM visualisation
// IMP: since SPARQL endpoint is not done, specific interfaces are required for each module to query data properly
// IMP: given an ontology, two classes, one relation and one attribute of datetime type
// UPG: add a SPARQL query system that acts as interface between modules and ontology database
let individualLast = function(ontologyName, firstClassName, individualName, relationshipName, secondClassName,
                              orderingAttributeName, requiredAttribute) {
    return new Promise(function(resolve, reject) {
        let uriElement = constructURI(ontologyName, individualName);
        session
            .run(`MATCH (n:${ontologyName}__${firstClassName}{uri:"${uriElement}"})
            <-[r:${ontologyName}__${relationshipName}]-(m:${ontologyName}__${secondClassName})
            RETURN m.${ontologyName}__${orderingAttributeName},m.${ontologyName}__${requiredAttribute} 
            ORDER BY datetime(m.${ontologyName}__${orderingAttributeName}) DESC LIMIT 1`)
            .then(function(result){
                if (result.records[0]._fields[0] !== null) {
                    resolve({
                        ontProperty: firstClassName,
                        ontOntology: ontologyName,
                        ontMeasure: secondClassName,
                        ontResults: [{
                            ontName: orderingAttributeName,
                            ontValue: result.records[0]._fields[0]
                        }, {
                            ontName: requiredAttribute,
                            ontValue: result.records[0]._fields[1]
                        }]
                    });
                } else {
                    resolve({ontError:"Not found"});
                }
            })
            .catch(function(err){
                reject(err);
            });
    });
};
// Individual review: promises to assess individual and its properties against all consistency evaluations
let individualReview = async function(individual, ontologyName, individualName) {
    return await individualEvaluation(individual, ontologyName, individualName);
};
// Individual evaluation: to assess results of concurrent promises run at individual and property levels
// IMP: awaits for resolve evaluation results and organises them according to success, errors and warnings
// IMP: considers concurrent order in which previous promise returns results
let individualEvaluation = function(individual, ontologyName, individualName) {
    return new Promise(function(resolve, reject){
        // console.log("individualEvaluation");
        individualConsistency(individual, ontologyName, individualName)
            .then(function(results) {
                let successes = [];
                let errors = [];
                let warnings = [];
                // Class existence
                evaluateSuccess(results[0],successes,errors,warnings);
                // Individual properties
                results[1].forEach(function(property){
                    property.forEach(function(element){
                        evaluateSuccess(element,successes,errors,warnings);
                    });
                });
                // Ontology name
                evaluateSuccess(results[2],successes,errors,warnings);
                // Individual name
                evaluateSuccess(results[3],successes,errors,warnings);
                // Class properties lack
                evaluateSuccess(results[4],successes,errors,warnings);
                // Resolves a json object including success, errors and warning results of consistency evaluations
                resolve({ontSuccesses: successes, ontErrors: errors, ontWarnings: warnings});
                // IMP: evaluates results according to promise return json objects for each evaluation
                function evaluateSuccess (item,successes,errors,warnings) {
                    if (item["ontSuccess"]) {
                        return successes.push(item["ontSuccess"]);
                    } else if (item["ontError"]) {
                        return errors.push(item["ontError"]);
                    } else if (item["ontWarning"]) {
                        return warnings.push(item["ontWarning"]);
                    } else {}
                }
            })
            .catch(function(error) {
                reject(error);
            });
    });
};
// Individual assessment: to run all consistency evaluation promises for a given individual
// IMP: runs promises concurrently according to declaration order
// IMP: catches rejections to avoid next promises to stop working
// UPG: to modify sequential order for running promises that may affect others
let individualConsistency = async function (individual, ontologyName, individualName) {
    // console.log("individualConsistency");
    return await Promise.all([classExistence(individual), individualPropertiesConsistency(individual),
        ontologyNameCorrectness(individual,ontologyName),
        individualNameCorrecteness(individual,ontologyName,individualName),
        classPropertiesLack(individual)].map(p => p.catch(error => error)));
};
// Individual properties consistency: returns correctness of individual properties being instantiated
// IMP: maps the property evaluation promise to all properties declared by the individual
let individualPropertiesConsistency = async function (individual) {
    return await Promise.all(individual["ontProperties"].map(propertyConsistency));
};
// Individual name correctness: to evaluate the correctness of the individual being instantiated
// IMP: compares the individual name given by the post body and the post request parameters
// UPG: to extend name evaluation to specific naming conventions of certain classes
let individualNameCorrecteness = function(individual, ontologyName, individualName) {
    return new Promise(function(resolve) {
        let uriElement = constructURI(ontologyName, individualName);
        if (individual["ontName"]===uriElement){
            resolve ({ontSuccess:{ontLevel:"individual",ontName:individual["ontName"],
                    ontEvaluation:"nameCorrectness",ontValue:individual["ontName"]}});
        } else {
            resolve ({ontError:{ontLevel:"individual",ontName:individual["ontName"],
                    ontEvaluation:"nameCorrectness",ontValue:individual["ontName"]}});
        }
    });
};
/*====================================================================================================================*/
// C.4. Property level
// Property consistency: returns all consistency evaluations for a given property
// THE: evaluations have been classified according to compliance with rdfs rules or maintainability
// IMP: uses a property json object as declared for the post method
// IMP: promises are run concurrently without affecting each to return all evaluation results
// IMP: catches rejections of embedded properties to avoid next promise stopping
// UPG: to run promises sequentially when results can affect but retrieving all results at the end
// UPG: to modify order of promises to comply with sequential evaluation rules
// UPG: to extend evaluations to cover owl ontology description
let propertyConsistency = async function (individualProperty) {
    return await Promise.all([propertyDomain(individualProperty),propertyRange(individualProperty),
        propertyExistence(individualProperty),propertyValue(individualProperty)].map(p => p.catch(error => error)));
};
// Domain correctness: returns if the property domain in the ontology schema is as declared by the individual
// THE: rdfs:domain | compares the individual declaration against the class as described in the ontology schema
// IMP: promises to return as a json object the result of the evaluation
let propertyDomain = function(individualProperty) {
    return new Promise(function(resolve, reject) {
        session
        // Matches the existence of the domain for the property
            .run(`MATCH (a{uri:"${individualProperty["ontName"]}"})-[r:rdfs__domain]->
            (b{uri:"${individualProperty["ontDomain"]}"}) RETURN a.uri,b.uri`)
            .then(function(results) {
                // Resolves with a success or an error json object
                if (results.records.length !== 0) {
                    resolve ({ontSuccess:{ontLevel:"property", ontName:individualProperty["ontName"],
                            ontEvaluation:"domainCorrectness", ontValue:individualProperty["ontDomain"]}});
                } else {
                    resolve ({ontError:{ontLevel:"property",ontName:individualProperty["ontName"],
                            ontEvaluation:"domainCorrectness",ontValue:individualProperty["ontDomain"]}});
                }
            })
            // Rejection is used to cope with neo4j related errors
            .catch(function(error) {
                reject(error);
            });
    });
};
// Range correctness: returns if the property range in the ontology schema is as declared by the individual
// THE: rdfs:range | compares the individual declaration against the class as described in the ontology schema
// IMP: promises to return as a json object the result of the evaluation
let propertyRange = function(individualProperty) {
    return new Promise(function(resolve, reject) {
        session
        // Matches the existence of the property range
            .run(`MATCH (a{uri:"${individualProperty["ontName"]}"})-[r:rdfs__range]->
            (b{uri:"${individualProperty["ontRange"]}"}) RETURN a.uri,b.uri`)
            .then(function(results) {
                // Resolves for the property range according to evaluation json object
                if (results.records.length !== 0) {
                    resolve ({ontSuccess:{ontLevel:"property",ontName:individualProperty["ontName"],
                            ontEvaluation:"rangeCorrectness",ontValue:individualProperty["ontRange"]}});
                } else {
                    resolve ({ontError:{ontLevel:"property",ontName:individualProperty["ontName"],
                            ontEvaluation:"rangeCorrectness",ontValue:individualProperty["ontRange"]}});
                }
            })
            .catch(function(error) {
                reject(error);
            });
    });
};
// Property existence: returns if the property to be instantiated exists
// THE: rdfs:Resource | compares the uri's element against those existing in the knowledge base
// IMP: uses the element's uri to identify it is has been declared in the neo4j graph
// UPG: to check if it exists for the specific ontology to which the class being instantiated belongs
let propertyExistence = function(individualProperty) {
    return new Promise(function(resolve, reject) {
        session
        // Matches the existence of the property by URI
        // .run(`MATCH (n{uri:"${propertyURI}"}) RETURN n`)
            .run(`MATCH (n{uri:"${individualProperty["ontName"]}"}) RETURN n`)
            .then(function(results) {
                // Resolves for the property name according to evaluation json object
                if (results.records.length !== 0) {
                    resolve ({ontSuccess:{ontLevel:"property",ontName:individualProperty["ontName"],
                            ontEvaluation:"propertyExistence",ontValue:individualProperty["ontName"]}});
                } else {
                    resolve ({ontError:{ontLevel:"property",ontName:individualProperty["ontName"],
                            ontEvaluation:"propertyExistence",ontValue:individualProperty["ontName"]}});
                }
            })
            .catch(function(error) {
                reject(error);
            });
    });
};
// Property value existence: returns if the individual value to be instantiated exists
// THE: rdfs:Resource | compares the uri's element against those existing in the knowledge base
// IMP: evaluates only object type property values and sends a warning but not an error
// UPG: to extend to datatype property values using generic rules (e.g. int or double)
let propertyValue = function(individualProperty) {
    return new Promise(function(resolve, reject) {
        if (returnUriElement(individualProperty["ontType"]).includes("ObjectProperty")) {
            session
            // Matches the existence of the property value by URI
                .run(`MATCH (n{uri:"${individualProperty["ontValue"]}"}) RETURN n`)
                .then(function(results) {
                    if (results.records.length !== 0) {
                        resolve ({ontSuccess:{ontLevel:"property",ontName:individualProperty["ontName"],
                                ontEvaluation:"valueExistence",ontValue:individualProperty["ontValue"]}});
                    } else {
                        resolve ({ontWarning:{ontLevel:"property",ontName:individualProperty["ontName"],
                                ontEvaluation:"valueExistence",ontValue:individualProperty["ontValue"]}});
                    }
                })
                .catch(function(error) {
                    reject(error);
                });
        } else if (returnUriElement(individualProperty["ontType"]).includes("DatatypeProperty")) {
            // Evaluates if property value exists (is not null) when is not of object type
            // UPG: to include a rejection for the promise as it is missing
            if (individualProperty["ontValue"]!==null) {
                resolve ({ontSuccess:{ontLevel:"property",ontName:individualProperty["ontName"],
                        ontEvaluation:"valueExistence",ontValue:individualProperty["ontValue"]}});
            } else {
                resolve ({ontError:{ontLevel:"property",ontName:individualProperty["ontName"],
                        ontEvaluation:"valueExistence",ontValue:individualProperty["ontValue"]}});
            }
        } else {
            // Returns error because no support property type has been found
            resolve ({ontError:{ontLevel:"property",ontName:individualProperty["ontName"],
                    ontEvaluation:"supportedType",ontValue:individualProperty["ontValue"]}});
        }
    });
};
/*====================================================================================================================*/
// D. Ontologies instantiation
// THE: uses rdfs to identify all possible inferences that can be done for an ontology, class, individual or property
// IMP: returns and instantiates ontology entities in json format for rtrbau and ejs files http requests
// UPG: to include also reasoning about properties {datatype,object}
// UPG: to extend from rdfs to owl (REQUIRES of upgrading neosemantics)
/*====================================================================================================================*/
// D.1. Ontology level

/*====================================================================================================================*/
// D.2. Class level

/*====================================================================================================================*/
// D.3. Individual level
// Individual instantiation: promises to instantiate individual and its properties in neo4j knowledge base graph
// THE: to generate an individual and then assign all the values to the properties being instantiated
// IMP: follows same code structure as individual evaluation (property and individual levels)
// IMP: instantiation follows neo4j-neosemantics structure and notation
// IMP: generates a node, including class labels, and then instantiate properties
// IMP: properties are instantiated as node properties (data type) or as nodes with ontology relations (object type)
let individualInstantiation = async function (individual) {
    // console.log("individualInstantiation");
    let individualNodeInstantiation = await individualNodeCreation(individual);
    let individualPropsInstantiation = await individualPropertiesInstantiation(individual);
    return await [individualNodeInstantiation,individualPropsInstantiation];
};
// Individual instantiation: to generate the node in knowledge base graph representing the new individual
// IMP: uses neosemantics notation to merge node as owl:NamedIndividual and as of ontology class
let individualNodeCreation = function (individual) {
    return new Promise(function(resolve, reject){
        // Variables to manage uri names
        let ontologyName = returnUriOntology(individual["ontOntology"]);
        let className = returnUriElement(individual["ontClass"]);
        session
        // Merges individual as node by URI
            .run(`MERGE (n:Resource:owl__NamedIndividual:${ontologyName}__${className}
                {uri:"${individual["ontName"]}"}) RETURN n`)
            .then(function(results){
                resolve (results);
            })
            .catch(function(error){
                reject (error);
            })
    });
};
// Individual properties instantiation: to generate all properties that identifies the new individual
// IMP: promises instantiation of all individual properties
let individualPropertiesInstantiation = async function (individual) {
    // console.log("individualPropertiesInstantiation");
    return await Promise.all(individual["ontProperties"].map(function(property) {
        return individualPropertyCreation(individual["ontName"],individual["ontOntology"],property)}));
};
/*====================================================================================================================*/
// D.4. Property level
// Property creation: to instantiate a property value to an individual
// IMP: given the individual name, ontology name and the property (json object) instantiates the property to the individual
// IMP: differentiates between datatype (node property) and object type (relation and node) properties
// IMP: when object type merges with individual node as given by individualProperty["ontRange"]
let individualPropertyCreation = function (individualName,individualOntology,individualProperty) {
    return new Promise(function(resolve, reject){
        // Variables to manage uri names
        let ontologyName = returnUriOntology(individualOntology);
        let propertyName = returnUriElement(individualProperty["ontName"]);
        // Variable to manage cypher instantiation query
        let sessionQuery;
        // Evaluates property types
        if (returnUriElement(individualProperty["ontType"]).includes("ObjectProperty")) {
            // Matches individual by URI and merges new relation with existing or new individual
            sessionQuery = `MATCH (a{uri:"${individualName}"}) 
            MERGE (b:Resource:owl__NamedIndividual:
            ${returnUriOntology(individualProperty["ontRange"])}__${returnUriElement(individualProperty["ontRange"])}
            {uri:"${individualProperty["ontValue"]}"}) MERGE (a)-[r:${ontologyName}__${propertyName}]->(b) RETURN a,r,b`;
            // } else if (propertyTypes.includes("ObjectProperty")) {
        } else if (returnUriElement(individualProperty["ontType"]).includes("DatatypeProperty")) {
            // Matches individual by URI and sets a new node property
            sessionQuery = `MATCH (n{uri:"${individualName}"}) 
            SET n.${ontologyName}__${propertyName}="${individualProperty["ontValue"]}" RETURN n`;
        } else {}
        session
        // Runs cypher query and resolve results
            .run(sessionQuery)
            .then(function(results) {
                resolve(results);
            })
            .catch(function(error) {
                reject (error);
            });
    });
};
/*====================================================================================================================*/

/*====================================================================================================================*/
// 3.3. HTTP GET REQUESTS
/*====================================================================================================================*/
/*====================================================================================================================*/
// A. Files
/*====================================================================================================================*/
// File download: given a file full-name and type, send file
app.get('/api/files/:fileType/:fileName', function(req,res) {
    // IMP: check if file is of type owl when '.' not found
    if (!req.params.fileName.includes('.')) {
        req.params.fileName = req.params.fileName + ".owl";
    } else {}
    // ERR: if fileType is not found
    if(!returnFilesAvailable(path.join(__dirname,'assets','files'),req.params.fileType)) {
        res.status(404).send('File type not available');
    }
    // ERR: if fileName is not found
    else if(!returnFilesAvailable(path.join(__dirname,'assets','files',req.params.fileType),req.params.fileName)) {
        res.status(404).send('File not available');
    }
    else {
        // UPG: to include .owl when fileName did not include it in the first place
        res.sendFile(path.join(__dirname,'assets','files',req.params.fileType,req.params.fileName));
    }
});
/*====================================================================================================================*/
// B. Json
/*====================================================================================================================*/
// Ping: a ping request to ensure server is up and running
// UPG: upgrade to a more inventive ping
app.get('/api/ping', function(req,res) {
    // neo4j query session: uses cypher language to consult graphical database
    session
    // returns if neosemantics is installed on the server
    // implies that neo4j is up and running
        .run(`MATCH (n) RETURN n LIMIT 1`)
        .then(function(result) {
            res.json(result.records);
        })
        .catch(function(err) {
            res.json(err);
        });
});
// Ontologies Namespace: to retrieve existing proprietary ontologies in json format
app.get('/api/ontologies', function (req,res) {
    async function ontologiesJSON() {
        return await ontologies();
    }
    ontologiesJSON()
        .then(function(result) {
            res.json(result);
        })
        .catch(function(err) {
            res.json(err);
        });
});
// Class subclasses: to retrieve classes and subclasses within an ontology in json format
app.get('/api/ontologies/:ontologyName/class/:className/subclasses', function(req,res){
    async function classSubclassesJSON() {
        let uri = constructURI(req.params.ontologyName,req.params.className);
        return await classSubclasses(uri);
    }
    classSubclassesJSON()
        .then(function(result) {
            res.json(result);
        })
        .catch(function(err) {
            res.json(err);
        });
});
// Class individuals: to retrieve individuals that belong to a class in json format
app.get('/api/ontologies/:ontologyName/class/:className/individuals', function(req,res){
    async function classIndividualsJSON() {
        let uri = constructURI(req.params.ontologyName,req.params.className);
        return await classIndividuals(uri);
    }
    classIndividualsJSON()
        .then(function(result) {
            res.json(result);
        })
        .catch(function(err) {
            res.json(err);
        });
});
// Class properties: to retrieve properties that identify individuals of a class in json format
app.get('/api/ontologies/:ontologyName/class/:className/properties', function(req,res){
    async function classPropertiesJSON() {
        let uri = constructURI(req.params.ontologyName,req.params.className);
        return await classProperties(uri);
    }
    classPropertiesJSON()
        .then(function(result) {
            res.json(result);
        })
        .catch(function(err) {
            res.json(err);
        })
});
// Classes distance: to retrieve minimum distance between two classes in json format
app.get('/api/ontologies/:ontologyStartName/class/:classStartName/distance/:ontologyDistanceName/:ontologyEndName/class/:classEndName', function(req,res){
    async function classDistanceJSON() {
        return await classDistance(req.params.ontologyStartName, req.params.classStartName,
            req.params.ontologyDistanceName, req.params.ontologyEndName, req.params.classEndName);
    }
    classDistanceJSON()
        .then(function(result) {
            res.json(result);
        })
        .catch(function(err) {
            res.json(err);
        });
});
// Individual properties: to return the properties that describe an individual in an ontology in json format
app.get('/api/ontologies/:ontologyName/individual/:individualName/properties', function(req,res){
    async function individualPropertiesJSON() {
        let uri = constructURI(req.params.ontologyName,req.params.individualName);
        return await individualProperties(uri);
    }
    individualPropertiesJSON()
        .then(function(result) {
            res.json(result);
        })
        .catch(function(err) {
            res.json(err);
        });
});
// Individual example: to retrieve class individual with most number of relationships
// IMP: SPARQL query for Carar
app.get('/api/ontologies/:ontologyName/class/:className/example', function(req,res){
    async function classExampleJSON() {
        let classUri = constructURI(req.params.ontologyName,req.params.className);
        let individualUri = await classExample(classUri);
        return await individualProperties(individualUri);
    }
    classExampleJSON()
        .then(function(result) {
            res.json(result);
        })
        .catch(function(err) {
            res.json(err);
        });
});
// Individual last: to retrieve latest individual of a given class with the last datetime attribute
app.get('/api/cm/:ontologyName/class/:firstClassName/individual/:individualName/relation/:relationshipName/' +
    'class/:secondClassName/attribute/:orderingAttributeName/attribute/:requiredAttribute', function(req,res) {
    async function individualLastJSON() {
        let individualLastData = await individualLast(req.params.ontologyName, req.params.firstClassName,
            req.params.individualName, req.params.relationshipName, req.params.secondClassName,
            req.params.orderingAttributeName, req.params.requiredAttribute);
        return await individualLastData;
    }
    individualLastJSON()
        .then(function(result) {
            res.json(result);
        })
        .catch(function(err) {
            res.json(err);
        });
});
/*====================================================================================================================*/
// C. Views
/*====================================================================================================================*/
// Home view: to render index page to enable web navigation
app.get('/', function(req,res) {
   res.render('neoOntology/index');
});
// File namespace view: to render files types available
app.get('/view/files', function(req,res) {
    res.render('neoOntology/filetypes', {result:fs.readdirSync(path.join(__dirname,'assets','files'))});
});
// File type view: to render files available for a given type
// IMP: includes button to upload new file
app.get('/view/files/:fileType', function(req,res) {
    // ERR: if fileType is not available
    if(!returnFilesAvailable(path.join(__dirname,'assets','files'), req.params.fileType)) {
        res.status(404).send('File type not available');
    } else {
        let filesNames = fs.readdirSync(`assets/files/${req.params.fileType}`)
            .filter(item => !(/(^|\/)\.[^\/\.]/g).test(item));
        // Avoids '.' 'hidden' directories
        res.render('neoOntology/filetypeFiles',{result:{fileType:req.params.fileType,filesNames: filesNames}});
    }
});
// Ontologies namespace view: to render existing proprietary ontologies in json format
app.get('/view/ontologies', function (req,res) {
    async function ontologiesJSON() {
        return await ontologies();
    }
    ontologiesJSON()
        .then(function(result) {
            res.render('neoOntology/ontologies',{result:result});
        })
        .catch(function(err) {
            res.json(err);
        });
});
// Class subclasses view: to render classes and subclasses within an ontology in json format
// IMP: points to subclasses if found, otherwise points to properties if also found
// IMP: includes buttons to report those classes with attributes and buttons to individuals if found
// UPG: to consider the situation where superclasses may also have individuals (owl upgrade)
app.get('/view/ontologies/:ontologyName/class/:className/subclasses', function(req,res) {
    let classUri = constructURI(req.params.ontologyName, req.params.className);
    let subclassesUris = function(uri) {
        return new Promise(function(resolve,reject) {
            classSubclasses(uri)
                .then(function(result) {
                    let subclassesUris = [];
                    result.ontSubclasses.forEach(function(subclass) {
                       subclassesUris.push(subclass.ontSubclass);
                    });
                    resolve(subclassesUris);
                })
                .catch(function(err) {
                    reject(err);
                });
        })
    };
    let subclassesSubclassesIndividualsProperties = async function(uri) {
        return await Promise.all([classSubclasses(uri), classProperties(uri), classIndividuals(uri)]
              .map(p => p.catch(error => error)));
    };
    let subclassesJSON = async function(uri) {
        let subclassesList = await subclassesUris(uri);
        return await Promise.all(subclassesList.map(subclassesSubclassesIndividualsProperties));
    };
    subclassesJSON(classUri)
        .then(function(result) {
            res.render('neoOntology/classSubclasses',{uri:classUri,result:result});
        })
        .catch(function(err) {
            res.json(err);
        });
});
// Class individuals view: to render ontology class and individuals in json format
// IMP: includes links to individuals and button to report similar class individuals
app.get('/view/ontologies/:ontologyName/class/:className/individuals', function(req,res) {
    async function classIndividualsJSON() {
        let uri = constructURI(req.params.ontologyName,req.params.className);
        return await classIndividuals(uri);
    }
    classIndividualsJSON()
        .then(function(result) {
            res.render('neoOntology/classIndividuals',{result:result});
        })
        .catch(function(err) {
            res.json(err);
        });
});
// Class properties view: to render ontology class properties
// IMP: includes buttons to report individual if properties found and to check existing individuals if found
// IMP: includes links to object properties
app.get('/view/ontologies/:ontologyName/class/:className/properties', function(req,res) {
    let classUri = constructURI(req.params.ontologyName,req.params.className);
    async function classPropertiesIndividualsJSON(uri) {
        return await Promise.all([classProperties(uri),classIndividuals(uri)].map(p => p.catch(error => error)));
    }
    classPropertiesIndividualsJSON(classUri)
        .then(function(result) {
            res.render('neoOntology/classProperties',{result:result});
        })
        .catch(function(err) {
            res.json(err);
        });
});
// Class individual input view: to render class properties and properties classes and individuals to input individual
// IMP: includes button to redirect to the individual input view POST request (equal to json with HTTP referer)
// IMP: requests class properties as well as properties classes individuals to enable correct input
app.get('/view/ontologies/:ontologyName/class/:className/individual/:individualName/input/form', function(req,res) {
    let classUri = constructURI(req.params.ontologyName, req.params.className);
    let indUri = constructURI(req.params.ontologyName, req.params.individualName);
    let opClassProperties = function(property) {
        return new Promise(function(resolve,reject) {
            if (returnUriElement(property["ontType"]).includes("ObjectProperty")) {
                classProperties(property["ontRange"])
                    .then(function(result) {
                        property["ontProperties"] = result;
                        resolve(property);
                    })
                    .catch(function(err) {
                        reject(err);
                    });
            } else {
                resolve(property);
            }

        });
    };
    let opClassIndividuals = function(property) {
        return new Promise(function(resolve,reject) {
            if (returnUriElement(property["ontType"]).includes("ObjectProperty")) {
                classIndividuals(property["ontRange"])
                    .then(function(result) {
                        property["ontIndividuals"] = result;
                        resolve(property);
                    })
                    .catch(function(err) {
                        reject(err);
                    })
            } else {
                resolve(property);
            }
        });
    };
    let opClasses = async function(classProps) {
        return await Promise.all(classProps.map(opClassProperties));
    };
    let opIndividuals = async function(classProps) {
        return await Promise.all(classProps.map(opClassIndividuals));
    };
    let classProps = async function(uri) {
        let props = await classProperties(uri);
        let propsClasses = await opClasses(props["ontProperties"]);
        let propsClassesIndividuals = await opIndividuals(propsClasses);
        // return await propsClassesIndividuals;
        return await props;
    };
    let classForm = function(props) {
        return new Promise(function(resolve, reject) {
            let formProps = [];
            props["ontProperties"].forEach(function(property) {
                if (returnUriElement(property["ontType"]).includes("ObjectProperty")) {
                    let link = "";
                    let options = [];
                    if (property["ontIndividuals"]["ontIndividuals"].length === 0) {}
                    else {
                        property["ontIndividuals"]["ontIndividuals"].forEach(function(p) {
                            options.push(returnUriElement(p["ontIndividual"]));
                        });
                    }
                    if (property["ontProperties"]["ontProperties"].length === 0) {}
                    else { link = returnUriElement(property["ontProperties"]["ontClass"]); }
                    formProps.push({
                        propType: "select",
                        propName: returnUriElement(property["ontName"]),
                        propFormat: returnUriElement(property["ontRange"]),
                        propLink: link,
                        propOptions: options
                    });
                } else if (returnUriElement(property["ontType"]).includes("DatatypeProperty")) {
                    formProps.push({
                        propType: "text",
                        propName: returnUriElement(property["ontName"]),
                        propFormat: returnUriElement(property["ontRange"]),
                        propLink: "",
                        propOptions: []
                    });
                } else {}
            });
            resolve(formProps);
        });
    };
    let form = async function(uri) {
        let props = await classProps(uri);
        let propsForm = await classForm(props);
        return await propsForm;
    };
    form(classUri)
        .then(function(result) {
            res.render('neoOntology/classIndividualInputForm', {
                indOnt: req.params.ontologyName,
                indClass: req.params.className,
                indName: req.params.individualName,
                indProps: result});})
        .catch(function(err) {res.json(err);})
});
// Individual properties view: to render ontology individual and its properties
// IMP: includes links to other individuals and button to report similar class individual
app.get('/view/ontologies/:ontologyName/individual/:individualName/properties', function(req,res) {
    async function individualPropertiesJSON() {
        let uri = constructURI(req.params.ontologyName,req.params.individualName);
        return await individualProperties(uri);
    }
    individualPropertiesJSON()
        .then(function(result) {
            res.render('neoOntology/individualProperties',{result:result});
        })
        .catch(function(err) {
            res.json(err);
        });
});
/*====================================================================================================================*/

/*====================================================================================================================*/
// 3.4. HTTP POST REQUESTS
/*====================================================================================================================*/
/*====================================================================================================================*/
// A. Files
/*====================================================================================================================*/
// Single file input: to upload single file by type
// IMP: {headers:null, body:{form-data:{key:'file',value:rawFile}}}
app.post('/api/files/:fileType/upload', function(req,res) {
    upload(req, res, function(err) {
        if (req.fileValidationError) {return res.send(req.fileValidationError);}
        else if (!req.file) {return res.send('Please select a file to upload');}
        else if (err instanceof multer.MulterError) {return res.send(err);}
        else if (err) {return res.send(err);}
        else {res.send('File uploaded successfully');}
    });
});
/*====================================================================================================================*/
// B. Json
/*====================================================================================================================*/
// Class individual input: to input an individual in the ontology graph after consistency evaluation with a given class
// IMP: {headers:null}
// IMP: body:{{ontName:,ontOntology:,ontClass:,ontProperties:[{ontName:,ontValue:,ontDomain:,ontRange:,ontType:}]}}
// UPG: to create one single function so it can be re-used in the view POST request
app.post('/api/ontologies/:ontologyName/individual/:individualName/input', function(req,res) {
    // Awaits for individual review resolution to run promise on individual instantiation and return warnings/errors
    individualReview(req.body, req.params.ontologyName, req.params.individualName)
        .then(function(reviewResults) {
            if (reviewResults["ontErrors"].length !== 0) {
                res.send({ontWarnings:reviewResults["ontWarnings"],ontErrors:reviewResults["ontErrors"]});
            } else {
                individualInstantiation(req.body)
                    .then(function(inputResults) {
                        let inputResolution = [];
                        inputResolution.push(inputResults[0]["records"]);
                        inputResults[1].forEach(function(result){inputResolution.push(result["records"])});
                        // res.send({ontWarnings:reviewResults["ontWarnings"],ontInput:inputResolution});
                        res.send({ontWarnings:reviewResults["ontWarnings"]});
                    })
                    .catch(function(inputError) {
                        res.send(inputError);
                    });
            }
        })
        .catch(function(reviewError) {
            res.send(reviewError);
        });
});
/*====================================================================================================================*/
// C. Views
/*====================================================================================================================*/
// Class individual input: to input a given individual using the result from the view input form
app.post('/view/ontologies/:ontologyName/class/:className/individual/:individualName/input/result',function(req,res) {
    // Uses post request body to generate class individual formatted for individualInstantiation
    let ontOntUri = neontURL + req.params.ontologyName + "#";
    let ontClassUri = constructURI(req.params.ontologyName,req.params.className);
    let ontIndUri = constructURI(req.params.ontologyName, req.params.individualName);
    let indPropsForm = function(indForm) {
        return new Promise(function(resolve,reject) {
            let indProps = [];
            for(var prop in indForm) {
                indProps.push({
                    propOnt: req.params.ontologyName,
                    propClass: req.params.className,
                    propName: prop,
                    propValue: indForm[prop]
                });
            }
            // console.log(indProps);
            resolve(indProps);
        });
    };
    let indPropEval = async function(indProp) {
        let classUri = constructURI(indProp["propOnt"],indProp["propClass"]);
        let classProps = await classProperties(classUri);
        return new Promise(function(resolve,reject) {
            let prop;
            classProps["ontProperties"].forEach(function(classProp) {
                let classPropName = returnUriElement(classProp["ontName"]);
                // Check if class property name coincides with inputted individual property
                // Ensures the right structure and array size is returned
                if (classPropName === indProp["propName"]) {
                    // If value is empty, then do not consider ontInput = false, ontNew = false
                    if (indProp["propValue"] !== "") {
                        // Check if class property type is object or datatype, otherwise do not consider
                        let classPropType = returnUriElement(classProp["ontType"]);
                        //console.log(classProp["ontType"]);
                        //console.log(indProp["propValue"].includes("__New"));
                        if (classPropType.includes("ObjectProperty")) {
                            // Check if individual property value is new
                            if (indProp["propValue"].includes("__New")) {
                                let propClassName = returnUriElement(classProp["ontRange"]);
                                let propClassOntology = returnUriOntology(classProp["ontRange"]);
                                let indValue = constructNewIndividualURI(propClassOntology, propClassName);
                                //console.log(indValue);
                                prop = {
                                    ontInput: true,
                                    ontNew: true,
                                    ontName: classProp["ontName"],
                                    ontValue: indValue,
                                    ontDomain: classProps["ontClass"],
                                    ontRange: classProp["ontRange"],
                                    ontType: classProp["ontType"]
                                };
                            } else {
                                let propClassOntology = returnUriOntology(classProp["ontRange"]);
                                let indValue = neontURL + propClassOntology + "#" + indProp["propValue"];
                                //console.log(indValue);
                                prop = {
                                    ontInput: true,
                                    ontNew: false,
                                    ontName: classProp["ontName"],
                                    ontValue: indValue,
                                    ontDomain: classProps["ontClass"],
                                    ontRange: classProp["ontRange"],
                                    ontType: classProp["ontType"]
                                };
                            }
                        } else if (classPropType.includes("DatatypeProperty")) {
                            prop = {
                                ontInput: true,
                                ontNew: false,
                                ontName: classProp["ontName"],
                                ontValue: indProp["propValue"],
                                ontDomain: classProps["ontClass"],
                                ontRange: classProp["ontRange"],
                                ontType: classProp["ontType"]
                            };
                        } else {
                            reject("ontType " + classProp["ontType"] + " not supported");
                        }
                    } else {
                        prop = {
                            ontInput: false,
                            ontNew: false,
                            ontName: classProp["ontName"],
                            ontValue: indProp["propValue"],
                            ontDomain: classProps["ontClass"],
                            ontRange: classProp["ontRange"],
                            ontType: classProp["ontType"]
                        };
                    }
                } else {}
            });
            resolve(prop);
        });
    };
    let indPropsEval = async function(indForm) {
        let indProps = await indPropsForm(indForm);
        return await Promise.all(indProps.map(indPropEval).map(p => p.catch(error => error)));
    };
    let indEvalResult = async function(indForm) {
        let indEval = await indPropsEval(indForm);
        return new Promise(function(resolve,reject) {
            let ontProperties = [];
            let newIndividuals = [];
            indEval.forEach(function(attribute) {
                if (attribute.ontInput === true) {
                    ontProperties.push({
                        ontName: attribute.ontName,
                        ontValue: attribute.ontValue,
                        ontDomain: attribute.ontDomain,
                        ontRange: attribute.ontRange,
                        ontType: attribute.ontType
                    });
                } else {}
                if (attribute.ontNew === true) {
                    newIndividuals.push({
                        ontIndividual: returnUriElement(attribute.ontValue),
                        ontClass: returnUriElement(attribute.ontRange),
                        ontOntology: returnUriOntology(attribute.ontRange)
                    });
                } else {}
            });
            resolve({
                ontIndividual: {
                    ontName: ontIndUri,
                    ontOntology: ontOntUri,
                    ontClass: ontClassUri,
                    ontProperties: ontProperties
                },
                newIndividuals: newIndividuals});
        });
    };
    let indResult = async function(indForm, ontName, indName) {
        // console.log(indForm);
        let indFormResult = await indEvalResult(indForm);
        let indReviewResult = await individualEvaluation(indFormResult["ontIndividual"], ontName, indName);
        return await [indFormResult,indReviewResult];
    };
    indResult(req.body,req.params.ontologyName,req.params.individualName)
        .then(function(result) {
            if (result[1]["ontErrors"].length !== 0) {
                res.render('neoOntology/classIndividualInputResult',{
                    indOnt: returnUriElement(result[0]["ontIndividual"]["ontOntology"]),
                    indClass: returnUriElement(result[0]["ontIndividual"]["ontClass"]),
                    indName: returnUriElement(result[0]["ontIndividual"]["ontName"]),
                    indWarnings: result[1]["ontWarnings"],
                    indErrors: result[1]["ontErrors"],
                    newIndividuals: result[0]["newIndividuals"]
                });
            } else {
                individualInstantiation(result[0]["ontIndividual"])
                    .then(function(inputResults) {
                        let inputResolution = [];
                        inputResolution.push(inputResults[0]["records"]);
                        inputResults[1].forEach(function(result){inputResolution.push(result["records"])});
                        // res.send({ontWarnings:reviewResults["ontWarnings"],ontInput:inputResolution});
                        // console.log(returnUriElement(result[0]["ontIndividual"]["ontOntology"]));
                        res.render('neoOntology/classIndividualInputResult',{
                            indOnt: returnUriElement(result[0]["ontIndividual"]["ontOntology"]),
                            indClass: returnUriElement(result[0]["ontIndividual"]["ontClass"]),
                            indName: returnUriElement(result[0]["ontIndividual"]["ontName"]),
                            indWarnings: [],
                            indErrors: [],
                            newIndividuals: result[0]["newIndividuals"]
                        });
                    })
                    .catch(function(inputError) {
                        res.json(inputError);
                    });
            }
        })
        .catch(function(err) {res.json(err);})
});
// Another view post:
// IMP:
// Another view post:
// IMP:
/*====================================================================================================================*/

/*====================================================================================================================*/
// 3.5. HTTP PUT REQUESTS
/*====================================================================================================================*/
/*====================================================================================================================*/
// A. Files
/*====================================================================================================================*/

/*====================================================================================================================*/
// B. Json
/*====================================================================================================================*/

/*====================================================================================================================*/
// C. Views
/*====================================================================================================================*/

/*====================================================================================================================*/


/*====================================================================================================================*/
// 3.6. HTTP DELETE REQUESTS
/*====================================================================================================================*/
/*====================================================================================================================*/
// A. Files
/*====================================================================================================================*/

/*====================================================================================================================*/
// B. Json
/*====================================================================================================================*/

/*====================================================================================================================*/
// C. Views
/*====================================================================================================================*/

/*====================================================================================================================*/


/*====================================================================================================================*/
// 4. NEOONTOLOGYCM
// Asset monitoring services
// IMP: includes direct ontology calls to neo4j and real-time inferencing
/*====================================================================================================================*/
/*====================================================================================================================*/
// A. Methods
/*====================================================================================================================*/
// Monitor inferencing
// IMP: to infer monitors, auditors, states and devices involved in monitoring a given asset
let monitorsQuery = function(assetURI) {
    return `MATCH (st:diagont__State)-[:diagont__auditorMonitorsState]-(ad:diagont__Auditor{diagont__isValidated: 'true'})-[:diagont__considersAuditor]-(mo:diagont__Monitor)-[:diagont__encountersFailure]-(fa:diagont__Failure)-[*..2]-(at:orgont__Asset) 
            MATCH (st:diagont__State)-[:diagont__measuredByDevice]-(dv:orgont__Device) 
            MATCH (fa:diagont__Failure)-[:diagont__hasFailureImpact]-(faIM:diagont__Impact) 
            MATCH (fa:diagont__Failure)-[:diagont__hasFailureDominion]-(faDM:diagont__Dominion) 
            MATCH (fa:diagont__Failure)-[:diagont__hasFailurePhenomenon]-(faPH:diagont__Phenomenon) 
            MATCH (ad:diagont__Auditor)-[:diagont__hasAuditorComparison]-(adCM:diagont__Comparison) 
            MATCH (st:diagont__State)-[:diagont__hasStateUnit]-(stUN:diagont__Unit) 
            MATCH (st:diagont__State)-[:diagont__hasStateStatus]-(stST:diagont__Status)
            WHERE at.uri = "${assetURI}" 
            RETURN DISTINCT mo.uri, mo.diagont__hasMonitorDescription, fa.uri, fa.diagont__hasFailureDescription, faIM.uri, faDM.uri, faPH.uri, ad.uri, adCM.uri, st.uri, st.diagont__hasStateValue, stUN.uri, stST.uri, dv.uri`;
};
// Task inferencing
// IMP: to infer tasks, steps, states and devices involved in monitoring a given asset
// IMP: follows inferencing rules to turn tasks and steps into monitors and auditors
let tasksQuery = function(assetURI) {
    return `MATCH (st:diagont__State)-[:diagont__stepDiagnosesState]-(sp:diagont__Step{diagont__isContributory: 'true'})-[:diagont__belongsToTask]-(tk:diagont__Task)-[:diagont__identifiedByTask]-(fa:diagont__Failure)-[*..2]-(at:orgont__Asset) 
            MATCH (st:diagont__State)-[:diagont__measuredByDevice]-(dv:orgont__Device) 
            MATCH (fa:diagont__Failure)-[:diagont__hasFailureImpact]-(faIM:diagont__Impact) 
            MATCH (fa:diagont__Failure)-[:diagont__hasFailureDominion]-(faDM:diagont__Dominion) 
            MATCH (fa:diagont__Failure)-[:diagont__hasFailurePhenomenon]-(faPH:diagont__Phenomenon) 
            MATCH (sp:diagont__Step)-[:diagont__hasStepComparison]-(spCM:diagont__Comparison) 
            MATCH (st:diagont__State)-[:diagont__hasStateUnit]-(stUN:diagont__Unit)
            MATCH (st:diagont__State)-[:diagont__hasStateStatus]-(stST:diagont__Status)
            WHERE at.uri = "${assetURI}" 
            RETURN DISTINCT tk.uri, tk.diagont__hasTaskDescription, fa.uri, fa.diagont__hasFailureDescription, faIM.uri, faDM.uri, faPH.uri, sp.uri, spCM.uri, st.uri, st.diagont__hasStateValue, stUN.uri, stST.uri, dv.uri`;
};
// Device current state inferencing
// IMP: to infer the latest state given by a device which measures the same unit as the monitored state
let deviceQuery = function(deviceURI,stateUnitURI) {
    return `MATCH (dv:orgont__Device{uri:"${deviceURI}"})<-[:diagont__measuredByDevice]-(st:diagont__State)-[:diagont__hasStateUnit]-(stUN:diagont__Unit{uri:"${stateUnitURI}"}) 
    MATCH (st:diagont__State)-[:diagont__refersToComponent]->(cm:orgont__Component)
    RETURN st.uri, st.diagont__hasStateValue, stUN.uri, st.diagont__hasStateDate, cm.uri
    ORDER BY datetime(st.diagont__hasStateDate) DESC LIMIT 1`;
};
// Monitor result inferencing
// IMP: to infer results of monitors and tasks
function evaluateMonitor(monitor) {
    let monitorStatus = constructURI("diagont","Normal");
    monitor.auditors.forEach(function(auditor) {
        evaluateAuditor(auditor);
        if (auditor.auditorComparisonStatus === constructURI("diagont","Normal")) {
            // Do nothing
        }
        else if (auditor.auditorComparisonStatus === constructURI("diagont","SafelyDegraded")) {
            if (monitorStatus === constructURI("diagont","Normal")) {monitorStatus = auditor.auditorComparisonStatus;}
            else {} // Do nothing
        }
        else if (auditor.auditorComparisonStatus === constructURI("diagont","UnsafelyDegraded")) {
            if (monitorStatus === constructURI("diagont","Normal")) {monitorStatus = auditor.auditorComparisonStatus;}
            else if (monitorStatus === constructURI("diagont","SafelyDegraded")) {monitorStatus = auditor.auditorComparisonStatus;}
            else {} // Do nothing
        }
        else if (auditor.auditorComparisonStatus === constructURI("diagont","Faulty")) {
            if (monitorStatus === constructURI("diagont","Normal")) {monitorStatus = auditor.auditorComparisonStatus;}
            else if (monitorStatus === constructURI("diagont","SafelyDegraded")) {monitorStatus = auditor.auditorComparisonStatus;}
            else if (monitorStatus === constructURI("diagont","UnsafelyDegraded")) {monitorStatus = auditor.auditorComparisonStatus;}
            else {} // Do nothing
        }
        else {return -1;}
    });
    monitor.monitorStatus = monitorStatus;
}
// Auditor result inferencing
// IMP: to infer result of auditors and steps
function evaluateAuditor(auditor) {
    if (compareAuditorUnits(auditor.auditorCurrentStateUnit,auditor.auditorMonitorStateUnit)) {
        auditor.auditorComparisonResult = compareAuditorValues(auditor);
        if (auditor.auditorComparisonResult === true) {auditor.auditorComparisonStatus = auditor.auditorMonitorStateStatus;}
        else {auditor.auditorComparisonStatus = constructURI("diagont","Normal");}
    }
    else {
        auditor.auditorComparisonResult = -1;
    }
}
// Auditor values comparison
// IMP: to infer auditor result
function compareAuditorValues(auditor) {
    let comparison = auditor.auditorComparison.split("#")[1];
    let currentVal = parseFloat(auditor.auditorCurrentStateValue);
    let monitorVal = parseFloat(auditor.auditorMonitorStateValue);
    if (comparison === "EqualTo") {return currentVal === monitorVal;}
    else if (comparison === "NotEqualTo") {return currentVal !== monitorVal;}
    else if (comparison === "GreaterThanOrEqualTo") {return currentVal >= monitorVal;}
    else if (comparison === "GreaterThan") {return currentVal > monitorVal;}
    else if (comparison === "LessThanOrEqualTo") {return currentVal <= monitorVal;}
    else if (comparison === "LessThan") {return currentVal < monitorVal;}
    else { return -1;}
}
// Auditor units comparison
// IMP: to infer auditor result
function compareAuditorUnits(currentUnit,monitorUnit) {return currentUnit === monitorUnit;}
// Monitor parsing
// To parse each monitor/task record from neo4j to be added completely
function monitorJSON(record) {
    let json = {};
    json.monitorURI = record._fields[0];
    json.monitorDescription = record._fields[1];
    json.failureURI = record._fields[2];
    json.failureDescription = record._fields[3];
    json.failureImpact = record._fields[4];
    json.failureDominion = record._fields[5];
    json.failurePhenomenon = record._fields[6];
    json.auditors = [auditorJSON(record)];
    return json;
}
// Auditor parsing
// IMP: to parse each auditor/step record from neo4j to be added partially to a monitor/task record
function auditorJSON(record) {
    let json = {};
    json.auditorURI = record._fields[7];
    json.auditorComparison = record._fields[8];
    json.auditorMonitorStateURI = record._fields[9];
    json.auditorMonitorStateValue = record._fields[10];
    json.auditorMonitorStateUnit = record._fields[11];
    json.auditorMonitorStateStatus = record._fields[12];
    json.auditorStateDeviceURI = record._fields[13];
    return json;
}
// State parsing
// IMP: to parse each current state record from neo$J to be added partially to an auditor/step record
function stateJSON(record) {
    let json = {};
    json.auditorCurrentStateURI = record._fields[0];
    json.auditorCurrentStateValue = record._fields[1];
    json.auditorCurrentStateUnit = record._fields[2];
    json.auditorCurrentStateDate = record._fields[3];
    json.auditorMonitorComponentURI = record._fields[4];
    return json;
}
// Monitor containing auditor parsing
// IMP: to identify if an existing element in a json array has a value for a specific key
function contains(arr,key,val) {
    for (let i = 0; i < arr.length; i++) {
        if (arr[i][key] === val) return i;
    }
    return -1;
}
// Monitors and Tasks inferencing results
// IMP: to return the monitors and tasks inferencing results
let inferenceResults = function(inferenceQuery) {
  return new Promise(function(resolve, reject) {
      session
          .run(inferenceQuery)
          .then(function(result) {
              let array = [];
              result.records.forEach(function(record) {
                  let arrayID = contains(array,"monitorURI",record._fields[0]);
                  if (arrayID !== -1) {array[arrayID].auditors.push(auditorJSON(record));}
                  else {array.push(monitorJSON(record));}
              });
              resolve(array);
          })
          .catch(function(error) {
              reject(error);
          });
  });
};
// Device inferencing results
// IMP: to return the current states inferencing from given devices and monitored states
let currentResult = function(auditor) {
    return new Promise(function(resolve,reject) {
        let stateQuery = deviceQuery(auditor.auditorStateDeviceURI,auditor.auditorMonitorStateUnit);
        session
            .run(stateQuery)
            .then(function(result) {
                // resolve(result);
                let statesArray = [];
                result.records.forEach(function(record) {
                    statesArray.push(stateJSON(record));
                });
                resolve(statesArray);
            })
            .catch(function(error) {
                reject(error);
            });
    });
};
// IMP: to merge current state results with auditors one by one
let stateResults = async function(inferredResult) {
    let result = await(inferredResult);
    let resultState = await Promise.all(result.auditors.map(async function(auditor) {
        let state = await currentResult(auditor);
        Object.keys(state[0]).forEach(function(key) {
            auditor[key] = state[0][key];
        });
        // console.log(util.inspect(state,false,null,true));
        return state;
    }));
    return result;
};
// IMP: to await for current states promises once monitors and tasks have been retrieved
let additionalResults = async function(inferredResults) {
    let results = await inferredResults;
    return await Promise.all(results.map(async function(result) {return await stateResults(result);}));
};
/*====================================================================================================================*/
// B. Views
/*====================================================================================================================*/
// Control monitoring selection: to render "assets" to which control monitoring can be applied
// IMP: includes assets whose failures
// UPG: neo4j queries are made ad-hoc because this is a separate module from common functions above
app.get('/view/controlmonitoring', function(req, res) {
    // Identifies distinct "assets" and "assets" "systems" whose "failures" are "encountered" by "monitors"
    // With 3 relationships "assets" can be found ("affectsToAsset" or "affectsToSystem" and "hasAssetParent")
    // UPG: To modify so it becomes independent of diagont's ontology structure
    session
        .run(`MATCH (n:diagont__Monitor)-[*..3]->(m:orgont__Asset) RETURN DISTINCT m.uri`)
        .then(function(result) {
            let assets = [];
            if(result.records.length !== 0) {
                result.records.forEach(function(record) {
                    assets.push(returnUriElement(record._fields[0]));
                });
                res.render('neoOntologyCM/assetSelection',{assets});
            }
            else {
                res.json({ontError:"Monitored assets not found"});
            }
        })
        .catch(function(error) {
            res.json(error);
        });
});
// Control monitoring view: to render asserted and inferred "monitors" for a given "asset"
// IMP: includes inferencing of "monitors" from "tasks"
// IMP: includes reading latest sensor-given "states"
app.get('/view/controlmonitoring/:assetName', function(req, res) {
    let assetURI = constructURI("orgont",req.params.assetName);
    async function inferences(assetURI) {
        // Obtain monitors and tasks conducting inference
        let monitors = await inferenceResults(monitorsQuery(assetURI));
        let tasks = await inferenceResults(tasksQuery(assetURI));
        // console.log(util.inspect(tasks,false,null,true));
        // Update monitors and tasks with latest states from devices
        let monitorsStates = await additionalResults(monitors);
        let tasksStates = await additionalResults(tasks);
        return {asset: returnUriElement(assetURI), monitors: monitorsStates,tasks: tasksStates};
    }
    inferences(assetURI)
        .then(function(results) {
            results.monitors.forEach(function(monitor) {evaluateMonitor(monitor)});
            results.tasks.forEach(function(monitor) {evaluateMonitor(monitor)});
            res.render('neoOntologyCM/assetMonitoring',{results:results});
            // res.json(results);
        })
        .catch(function(error) {
            res.json(error);
        });
});
/*====================================================================================================================*/

/*====================================================================================================================*/
// 5. NEOONTOLOGYAR
// Ontology-based recommendation services
// IMP: includes direct ontology calls to neo4j and real-time inferencing for recommendation services
// UPG: to make these services generic and add them as part of neoOntology
/*====================================================================================================================*/
/*====================================================================================================================*/
// A. Methods
/*====================================================================================================================*/
// State inferencing
// IMP: to infer states that are recommendable for neoOntologyAR
let recommendableStatesQuery = function() {
    return `MATCH (st1:diagont__State)-[:diagont__auditorMonitorsState]-(ad:diagont__Auditor{diagont__isValidated: 'true'})
            RETURN st1.uri AS uri
            UNION
            MATCH (st2:diagont__State)-[:diagont__stepDiagnosesState]-(sp:diagont__Step{diagont__isContributory: 'true'})
            RETURN st2.uri AS uri`;
};
/*====================================================================================================================*/
// B. Views
/*====================================================================================================================*/
// State recommendation: to recommend states that is reasonable to evaluate for diagnosis
// IMP: includes states that are used by auditors and steps to diagnose failure
// IMP: only provides inferencing on states returned, similarity functions are applied within the service context
// UPG: neo4j queries are made ad-hoc because this is a separate module from common functions above
app.get('/api/recommendations/ontology/:ontologyName/class/:className/individuals', function(req, res) {
    // Returns class individuals in neoOntology format if :className coincides with the recommended class
    // UPG: to provide inferencing recommendation parameters through req.params
    if (req.params.ontologyName === "diagont" && req.params.className === "State") {
        // Build uri of recommended class
        let classURI = constructURI(req.params.ontologyName,req.params.className);
        // Run recommendableStatesQuery to return inferred states to recommend within neoOntologyAR
        session
            .run(recommendableStatesQuery())
            .then(function(result) {
                if (result.records.length !== 0) {
                    let individualsArray = [];
                    // Captures individual names retrieved by neo4j
                    result.records.forEach(function(record){
                        individualsArray.push({ontIndividual: record._fields[0]});
                    });
                    res.json({ontClass: classURI, ontIndividuals: individualsArray});
                }
                else {
                    res.json({ontError: "No recommendable individuals found"})
                }
            })
            .catch(function(error) {
                res.json(error);
            });
    }
    else {
        res.json({ontError: "Ontology or Class has not been implemented for recommendations"});
    }
});
/*====================================================================================================================*/

/*====================================================================================================================*/
// 6. PORT MANAGEMENT
/*====================================================================================================================*/
/*====================================================================================================================*/
// Initialise port for the server to start listen in
app.listen(port, function(){console.log(`Server listening on port: ${port}`)});
/*====================================================================================================================*/

/*====================================================================================================================*/
// 7. APP EXPORT
/*====================================================================================================================*/
/*====================================================================================================================*/
// IMP: to export the app (express) functions declare as a class
// UPG: when functions declared more generically, class can be exported to be used by other servers
module.export = app;
/*====================================================================================================================*/
