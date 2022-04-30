const mysql = require('mysql2');
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const port = 5000;
const loginData = require('./data/db.json')

const fs = require('fs');
const e = require('cors');
let filedata = fs.readFileSync('./data/db.json');
let userData = JSON.parse(filedata);

const connection = mysql.createConnection({
	host     : 'localhost',
	user     : 'root',
	password : 'admin',
	database : 'fuelio'
});

const app = express();
app.use(cors());
//app.use(cors({credentials: true, origin: 'http://localhost:3000'}));
app.use(session({
	secret: 'secret',
	saveUninitialized: false,
    resave: false,
    cookie: {secure: false}
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'static')));



app.get('/', function(request, response) {//ignore for now
	// Render login template
	response.sendFile(path.join(__dirname + '/login'));
});

app.get("/loginstatus", (request, response) => {
    let username = request.session.username;
    let login = false;
    if (username != null) {
        login = true;
    }

    response.send([username,login]);
})

app.post('/register', function(request, response){ //registering users
	let username = request.body.username;
	let password = request.body.password;
    let registered = false;

	if(username && password){
		connection.query(`SELECT * FROM UserCredentials WHERE username = '${username}'`, function(error, results, fields) {
			if(error) throw error;
			
			if (request.session.loggedin == true){
				response.send({
                    status: 'Already logged in. (FROM BACKEND)'
                });
				console.log("Already logged in. (BACKEND)");
			}
            else if (results.length > 0) {
                response.send({
                    status: 'Account name is already taken. (FROM BACKEND)'
                });
				console.log("Account name is already taken. (BACKEND)");
            } 
            else {
				try{
					// encrypt password using SHA2-256 hash function
					connection.promise().query(`INSERT INTO UserCredentials (username, password) VALUES('${username}', SHA2('${password}', 256))`);
					registered = true;
                    response.status(201).send({
                        status: 'Account created. (FROM BACKEND)',
                        registered
                    });
					console.log("Account created. (BACKEND)");
				}
				catch(err){
					console.log(err);
					console.log("Unexpected error occurred.");
				}
			}
			response.end();
		});	
	}
});

app.post('/auth', function(request, response) { //authenticating user logins
    //response.setHeader('Access-Control-Allow-Credentials', 'true')
    //console.log(request.body);

	// Capture the input fields
	let username = request.body.username;
	let password = request.body.password;
    let login;
    let SID;

	// Ensure the input fields exists and are not empty
	if (username && password) {
        console.log("Successfully obtained username and password");
		//Execute SQL query that'll select the account from the database based on the specified username and the password generated by the SHA2-256 hash function
		connection.query(`SELECT * FROM UserCredentials WHERE username = '${username}' AND password = SHA2('${password}', 256)`, function(error, results, fields) {
			// If there is an issue with the query, output the error
			if (error) throw error;
			// If the account exists
            if (request.session.loggedin == true) {
                console.log("You are already logged in! (BACKEND)");
                return response.send({
                    status: 'You are already logged in! (FROM BACKEND)',
                });
            }
			if (results.length > 0) {
				// Authenticate the user
                //loggedin = true;
				request.session.loggedin = true;
				request.session.username = username;
                login = request.session.loggedin;
                SID = request.sessionID;
                //request.session.save()
                response.send({
                    status: 'Successfully logged in. (FROM BACKEND)',
                    login,
                    username
                    //SID
                });
                console.log("Successfully logged in.");
                console.log(`Welcome back, ${request.session.username}!`);
                //console.log(request.sessionID)
                response.end();
                //response.status(200).end('OK');
                //response.redirect('http://localhost:3000/profile');
                //response.writeHead(301, {Location: `http://localhost:3000/profile`}).end();
			} 
            else {
				response.send({
                    status: 'Incorrect Username and/or Password! (FROM BACKEND)',
                });
				console.log("Incorrect Username and/or Password! (BACKEND)");
			}			
			response.end();
		});
	} else {
		response.send({
            status: 'Please enter Username and Password! (FROM BACKEND)'
        });
        console.log("Please enter Username and Password! (BACKEND)");
		response.end();
	}
});

app.post('/logout', function(request, response, next) { //force logout of user
    request.session.loggedin = false;
    let SID = request.sessionID;
    let login = request.session.loggedin;
    request.session.destroy()
    response.send({
        status: "Successfully logged out (FROM BACKEND)",
        login
    })
    console.log("Successfully logged out (BACKEND)");
    //console.log(SID);
    //console.log(login);
    response.end();
});

app.get('/profiledata', function(request, response) {
    let username = request.session.username;
    if (request.session.loggedin) {
        console.log(`Attempting to retrieve stored information for ${username}...`);
        connection.query(`SELECT fullname, address, address2, city, state, zipcode FROM ClientInformation WHERE (SELECT userid FROM UserCredentials WHERE username = '${username}') = ClientInformation.userid`, (err, results) => {
            if (err) throw err;

            var data;
            data = results[0];
            response.send(data);
            console.log(data);
        });
    } else {
        response.send({
            status: "Please login to view this page! (FROM BACKEND)"
        })
		console.log("Please login to view this page!");
	}
})

app.post('/profile', function(request, response) {
    //response.setHeader('Access-Control-Allow-Credentials', 'true')
    //console.log(request.body.state);
    //console.log(request.session.loggedin)
    //console.log(request.sessionID)
    let username = request.session.username;
	let fullname = request.body.name;
	let address = request.body.address;
	let address2 = request.body.address2;
	let city = request.body.city;
	let state = request.body.state;
	let zipcode = request.body.zipcode;

    let login = request.session.loggedin;
    let savedInfo = false;

	if (request.session.loggedin) {
		try{
			connection.promise().query(
                `INSERT INTO ClientInformation (userid, fullname, address, address2, city, state, zipcode)  
                VALUES((SELECT userid FROM UserCredentials WHERE username = '${username}'), 
                '${fullname}', '${address}', '${address2}', '${city}', '${state}', '${zipcode}') ON DUPLICATE KEY
                UPDATE fullname='${fullname}', address='${address}', address2='${address2}', city='${city}', state='${state}', zipcode='${zipcode}'`
            );
			
            savedInfo = true;
            testprof(savedInfo);
            response.status(201).send({
                status: 'Information saved.', 
                login,
                savedInfo
            });
			console.log("Information saved.");
		}
		catch(err){
			console.log(err);
			console.log("Information was not saved.");
		}
	} else {
        response.send({
            status: "Please login to view this page! (FROM BACKEND)"
        })
		console.log("Please login to view this page!");
	}
	response.end();
});

app.post("/pricingmodulecost", (request, response) => { //updating total cost when receiving request input
    let fuel_request = request.body.request;
    let fuel_price = 1.5;
	let reqFact;
    let inState;
    let histFact;
	let compprofit = 0.1;

    let login = request.session.loggedin;
    let savedInfo = false;

    if (request.session.loggedin) {
		try{
            if (connection.promise().query(`SELECT EXISTS(SELECT * FROM FuelQuote, ClientInformation WHERE (SELECT userid from UserCredentials WHERE username = '${request.session.username}') = ClientInformation.userid) = 1`)) {
                //SELECT fullname, address, address2, city, state, zipcode FROM ClientInformation WHERE (SELECT userid FROM UserCredentials WHERE username = '${username}') = ClientInformation.userid`
                histFact = 0.01;
                //console.log(histFact);
            }
            else {
                histFact = 0;
                //console.log(histFact);
            }
            if (fuel_request > 1000) {
                reqFact = 0.02;
            }
            else if (fuel_request < 1000) {
                reqFact = 0.03;
            }
        
            if (request.body.state == 'TX') {
                inState = 0.02;
            }
            else {
                inState = 0.04;
            }
            let margin = fuel_price * (inState - histFact + reqFact + compprofit);
            let perGal = fuel_price + margin;
            let fuel_cost = (fuel_request * perGal).toFixed(2);
            
            console.log(fuel_cost);            
			
            savedInfo = true;
            response.status(201).send({
                status: 'Fuel cost updated.', 
                login,
                savedInfo,
                price: fuel_price,
                cost: fuel_cost
            });
			console.log("Fuel cost updated.");
		}
		catch(err){
			console.log(err);
			console.log("Fuel cost could not be updated.");
		}
	} else {
        response.send({
            status: "Please login to view this page! (FROM BACKEND)"
        })
		console.log("Please login to view this page!");
	}
	response.end();
})

/*const costtest = {
    test1 : function(w,x,y,z) {
        let fuel_price = 1.5;
        let compprofit = 0.1;
        if (w > 1000) {
            reqFact = 0.02;
        }
        else {
            reqFact = 0.03;
        }
        return w * (fuel_price + (fuel_price * (x - y + reqFact + compprofit)))
    },
    test2 : function(w,x,y,z) {
        let fuel_price = 1.5;
        let compprofit = 0.1;
        if (w > 1000) {
            reqFact = 0.02;
        }
        else {
            reqFact = 0.03;
        }
        return w * (fuel_price + (fuel_price * (x - y + reqFact + compprofit)))
    },
    test3 : function(w,x,y,z) {
        let fuel_price = 1.5;
        let compprofit = 0.1;
        if (w > 1000) {
            reqFact = 0.02;
        }
        else {
            reqFact = 0.03;
        }
        return w * (fuel_price + (fuel_price * (x - y + reqFact + compprofit)))
    },
    test4 : function(w,x,y,z) {
        let fuel_price = 1.5;
        let compprofit = 0.1;
        if (w > 1000) {
            reqFact = 0.02;
        }
        else {
            reqFact = 0.03;
        }
        return w * (fuel_price + (fuel_price * (x - y + reqFact + compprofit)))
    },
    test5 : function(w,x,y,z) {
        let fuel_price = 1.5;
        let compprofit = 0.1;
        if (w > 1000) {
            reqFact = 0.02;
        }
        else {
            reqFact = 0.03;
        }
        return w * (fuel_price + (fuel_price * (x - y + reqFact + compprofit)))
    },
    test6 : function(w,x,y,z) {
        let fuel_price = 1.5;
        let compprofit = 0.1;
        if (w > 1000) {
            reqFact = 0.02;
        }
        else {
            reqFact = 0.03;
        }
        return w * (fuel_price + (fuel_price * (x - y + reqFact + compprofit)))
    }
}*/

/*const jesttests = {
    costtest: function(galreq, state, hasHist, loc) {
        let fuel_request = galreq;
        let fuel_price = 1.5;
        let reqFact;
        let inState = state;
        let histFact = hasHist
        let compprofit = 0.1;
        let location = loc;
        if (histFact == true) {
            histFact = 0.01;
            console.log(histFact);
        }
        else {
            histFact = 0;
            console.log(histFact);
        }
        if (fuel_request > 1000) {
            reqFact = 0.02;
        }
        else {
            reqFact = 0.03;
        }
        if (location == 'TX') {
            inState = 0.02;
        }
        else {
            inState = 0.04;
        }
        let fuel_cost = fuel_request * (fuel_price + (fuel_price * (inState - histFact + reqFact + compprofit)));
        return fuel_cost;
    }
}

module.exports = jesttests;*/

/*function testprof(t){
    if (t== true) {
        return "Information saved.";
    }
    else {
        return "Information not saved.";
    }
}
 
module.exports = testprof;*/

app.post("/fuelquotemodule", (request, response) => { //generating the actual fuel quote to be added to the database
    console.log('Retrieving data from frontend');
    let fuel_request = request.body.request;
    let fuel_date = request.body.date;
    let fuel_price = 1.5;
	let reqFact;
    let inState;
    let histFact;
	let compprofit = 0.1;
    /*if (connection.promise().query(`SELECT EXISTS(SELECT * FROM FuelQuote WHERE userid = '${request.session.username}')`) == 1) {
        histFact = 0.01;
        console.log(histFact);
    }
    else {
        histFact = 0;
        console.log(histFact);
    }
	if (fuel_request > 1000) {
		reqfact = 0.02;
	}
	else if (fuel_request < 1000) {
		reqfact = 0.03;
	}

    if (request.body.state == 'TX') {
        inState = 0.02;
    }
    else {
        inState = 0.04;
    }*/
    //let margin = fuel_price * (inState - )
    
    let login = request.session.loggedin;
    let savedInfo = false;

    if (request.session.loggedin) {
		try{
            if (connection.promise().query(`SELECT EXISTS(SELECT * FROM FuelQuote, ClientInformation WHERE (SELECT userid from UserCredentials WHERE username = '${request.session.username}') = ClientInformation.userid) = 1`)) { //select userid from usercredentials where username = etc
                histFact = 0.01;
                console.log(histFact);
                console.log(request.session.username);
            }
            else {
                histFact = 0;
                console.log(histFact);
                console.log(request.session.username);
            }
            if (fuel_request > 1000) {
                reqFact = 0.02;
            }
            else if (fuel_request < 1000) {
                reqFact = 0.03;
            }
        
            if (request.body.state == 'TX') {
                inState = 0.02;
            }
            else {
                inState = 0.04;
            }
            let margin = fuel_price * (inState - histFact + reqFact + compprofit);
            let perGal = fuel_price + margin;
            let fuel_cost = (fuel_request * perGal).toFixed(2);
            //connection.promise().query(`INSERT INTO FuelQuote (userid, cost) VALUES((SELECT userid FROM UserCredentials WHERE username = '${request.session.username}'),'${fuel_cost}')`);
            console.log(fuel_cost);

            connection.promise().query(
                `INSERT INTO FuelQuote (userid, request, date, price, cost)  
                VALUES((SELECT userid FROM UserCredentials WHERE username = '${request.session.username}'), 
                '${fuel_request}', '${fuel_date}', '${fuel_price}', '${fuel_cost}')` //remove unique key for duplicates?
            );
                
            savedInfo = true;
            response.status(201).send({
                status: 'Fuel quote created.', 
                login,
                savedInfo,
                cost: fuel_cost
            });
			console.log("Fuel quote created.");
		}
		catch(err){
			console.log(err);
			console.log("Fuel quote could not be created.");
		}
	} else {
        response.send({
            status: "Please login to view this page! (FROM BACKEND)"
        })
		console.log("Please login to view this page!");
	}
	response.end();
})

app.get("/fuelquotehist", (request, response) => {
    let username = request.session.username;
    connection.query(`SELECT fullname, address, address2, city, state, zipcode, request, date, price, cost FROM ClientInformation, FuelQuote WHERE (SELECT userid FROM UserCredentials WHERE username = '${username}') = ClientInformation.userid`, (err, results) => {
        if (err) throw err;
        response.send(results);
        console.log(results);
        console.log("hello");
    });
    /*response.send({
        address: "Calhoun Road",
        address2: "",
        city: "Houston",
        state: "Texas",
        zipcode: "77204"
    })*/
})

app.listen(port, () => {console.log(`Server started on port ${port}`)});