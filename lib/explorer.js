var request = require('request')
  , settings = require('./settings')
  , Address = require('../models/address');

var base_url = 'http://127.0.0.1:'+ settings.wallet.port +'/json_rpc';
var options = {
  uri: base_url,
  auth: {
    user: settings.wallet.user,
    pass: settings.wallet.pass,
    sendImmediately: false
  },
  json: true
  
};


// returns coinbase total sent as current coin supply
function coinbase_supply(cb) {
  Address.findOne({a_id: 'coinbase'}, function(err, address) {
    if (address) {
      return cb(address.sent);
    } else {
      return cb();
    }
  });
}

function real_request (method, callback, arguments = {}){
    options.body = {"jsonrpc":"2.0","id":"0","method": method, "params":arguments}
    request(options , function (error, response, body) {
      
      callback(error, body);
    });
  }
  
module.exports = {

  convert_to_satoshi: function(amount, cb) {
    // fix to 8dp & convert to string
    var fixed = amount.toFixed(8).toString(); 
    // remove decimal (.) and return integer 
    return cb(parseInt(fixed.replace('.', '')));
  },

  get_hashrate: function(cb) {
    if (settings.index.show_hashrate == false) return cb('-');
    if (settings.nethash == 'netmhashps') {
      var uri = base_url + 'getmininginfo';
      request({uri: uri, json: true}, function (error, response, body) { //returned in mhash
      
        if (body.netmhashps) {
          if (settings.nethash_units == 'K') {
            return cb((body.netmhashps * 1000).toFixed(4));
          } else if (settings.nethash_units == 'G') {
            return cb((body.netmhashps / 1000).toFixed(4));
          } else if (settings.nethash_units == 'H') {
            return cb((body.netmhashps * 1000000).toFixed(4));
          } else if (settings.nethash_units == 'T') {
            return cb((body.netmhashps / 1000000).toFixed(4));
          } else if (settings.nethash_units == 'P') {
            return cb((body.netmhashps / 1000000000).toFixed(4));
          } else {
            return cb(body.netmhashps.toFixed(4));
          }
        } else {
          return cb('-');
        }
        
        
      });
    } else {
      
      real_request("get_info" , function (error, body) {
          //console.log(body);
          var hashrate = body.result.difficulty / body.result.target;
        {
          if (settings.nethash_units == 'K') {
            return cb((hashrate / 1000).toFixed(4));
          } else if (settings.nethash_units == 'M'){
            return cb((hashrate / 1000000).toFixed(4));
          } else if (settings.nethash_units == 'G') {
            return cb((hashrate / 1000000000).toFixed(4));
          } else if (settings.nethash_units == 'T') {
            return cb((hashrate / 1000000000000).toFixed(4));
          } else if (settings.nethash_units == 'P') {
            return cb((hashrate / 1000000000000000).toFixed(4));
          } else {
            return cb((hashrate).toFixed(4));
          }
        }
      });
    }
  },
  
  

  get_difficulty: function(cb) {
    
    real_request("get_last_block_header" , function (error, body) {
        
        //console.log(body.result.block_header.difficulty);
        
        return cb(body.result.block_header.difficulty);
    });
  },

  get_connectioncount: function(cb) {
    real_request("get_info" , function (error, body) {
        
        //console.log(body.result.incoming_connections_count + body.result.outgoing_connections_count);
        
        return cb(body.result.incoming_connections_count + body.result.outgoing_connections_count);
    });
  },

  get_blockcount: function(cb) {
    real_request("get_block_count" , function (error, body) {
        
        //console.log(body.result.count);
        
        return cb(body.result.count);
    });
  },

  get_blockhash: function(height, cb) {
    real_request("on_get_block_hash" , function (error, body) {
        
        //console.log(body.result);
        
        return cb(body.result);
    }, [height]);
  },

  get_block: function(hash, cb) {
      var params = {'hash': hash};
    real_request("get_block" , function (error, body) {
        //console.log("hash: "+hash);
        //console.log("result: "+body.result);
        
        if(body.result == undefined)
            return cb(null);
        
        var resultststs = body.result.block_header;
        
        resultststs.time = resultststs.timestamp;
        resultststs.bits = resultststs.block_size;
        resultststs.json = body.result.json;
        
        resultststs.tx = [];
        if(resultststs.tx_hashes != null)
            resultststs.tx = resultststs.tx_hashes;
        resultststs.tx.push(resultststs.miner_tx_hash);
        //console.log(resultststs);
        
        
        return cb(resultststs);
    }, params);
  },

  get_rawtransaction: function(txhash, cb) {
        
    var url = 'http://127.0.0.1:'+ settings.wallet.port +'/gettransactions';
    var m_options = {
      uri: url,
      auth: {
        user: settings.wallet.user,
        pass: settings.wallet.pass,
        sendImmediately: false
      },
      json: true
      
    };
    
    m_options.body = {"txs_hashes":[txhash]}
    request(m_options , function (error, response, body) {
        //console.log(" the raw transaction");
        var theReturned = body.txs[0];
        //console.log(theReturned);
        
        module.exports.get_blockhash(theReturned.block_height, function (hash) {
            theReturned.blockhash = hash;
            
            module.exports.get_block(hash, function (theblock) {
                
                if(theReturned.vin == null || theReturned.vin == undefined)
                    theReturned.vin = [];
                if(theReturned.vout == null || theReturned.vout == undefined)
                    theReturned.vout = [];
                //console.log(theblock.miner_tx_hash);
                //console.log(txhash);
                if(theblock.miner_tx_hash == txhash)
                {
                    //console.log("JAYSON: ");
                    var json =JSON.parse(theblock.json);
                    theReturned.vin = [{"coinbase": txhash}];
                    theReturned.vin[0].addresses = "coinbase";
                    theReturned.vout = json.miner_tx.vout;
                                 
                    //console.log(theReturned.vin);
                    //console.log(theReturned.vout);
                    
                }
                
                
                
                
                return cb(theReturned);
            });
            
            
        });
        
        
    });
        
  },

  get_maxmoney: function(cb) {
    var uri = base_url + 'getmaxmoney';
    request({uri: uri, json: true}, function (error, response, body) {
      return cb(body);
    });
  },

  get_maxvote: function(cb) {
    var uri = base_url + 'getmaxvote';
    request({uri: uri, json: true}, function (error, response, body) {
      return cb(body);
    });
  },

  get_vote: function(cb) {
    var uri = base_url + 'getvote';
    request({uri: uri, json: true}, function (error, response, body) {
      return cb(body);
    });
  },

  get_phase: function(cb) {
    var uri = base_url + 'getphase';
    request({uri: uri, json: true}, function (error, response, body) {
      return cb(body);
    });
  },

  get_reward: function(cb) {
    var uri = base_url + 'getreward';
    request({uri: uri, json: true}, function (error, response, body) {
      return cb(body);
    });
  },

  get_estnext: function(cb) {
    var uri = base_url + 'getnextrewardestimate';
    request({uri: uri, json: true}, function (error, response, body) {
      return cb(body);
    });
  },

  get_nextin: function(cb) {
    var uri = base_url + 'getnextrewardwhenstr';
    request({uri: uri, json: true}, function (error, response, body) {
      return cb(body);
    });
  },
  
  // synchonous loop used to interate through an array, 
  // avoid use unless absolutely neccessary
  syncLoop: function(iterations, process, exit){
    var index = 0,
        done = false,
        shouldExit = false;
    var loop = {
      next:function(){
          if(done){
              if(shouldExit && exit){
                  exit(); // Exit if we're done
              }
              return; // Stop the loop if we're done
          }
          // If we're not finished
          if(index < iterations){
              index++; // Increment our index
              if (index % 100 === 0) { //clear stack
                setTimeout(function() {
                  process(loop); // Run our process, pass in the loop
                }, 1);
              } else {
                 process(loop); // Run our process, pass in the loop
              }
          // Otherwise we're done
          } else {
              done = true; // Make sure we say we're done
              if(exit) exit(); // Call the callback on exit
          }
      },
      iteration:function(){
          return index - 1; // Return the loop number we're on
      },
      break:function(end){
          done = true; // End the loop
          shouldExit = end; // Passing end as true means we still call the exit callback
      }
    };
    loop.next();
    return loop;
  },

  balance_supply: function(cb) {
    Address.find({}, 'balance').where('balance').gt(0).exec(function(err, docs) { 
      var count = 0;
      module.exports.syncLoop(docs.length, function (loop) {
        var i = loop.iteration();
        count = count + docs[i].balance;
        loop.next();
      }, function(){
        return cb(count);
      });
    });
  },

  get_supply: function(cb, count = null) {
    if ( settings.supply == 'HEAVY' ) {
      var uri = base_url + 'getsupply';
      request({uri: uri, json: true}, function (error, response, body) {
        return cb(body);
      });
    } else if (settings.supply == 'GETINFO') {
      var uri = base_url + 'getinfo';
      request({uri: uri, json: true}, function (error, response, body) {
        return cb(body.moneysupply);
      });
    } else if (settings.supply == 'BALANCES') {
      module.exports.balance_supply(function(supply) {
        return cb(supply/100000000);
      });
    } else if (settings.supply == 'TXOUTSET') {
        params = {'height': 0, "count": count};
        real_request("get_coinbase_tx_sum" , function (error, body) {
            
            //console.log(params);
            //console.log("supply: ");
            //console.log(body.result.emission_amount + body.result.fee_amount);
            
            
            return cb((body.result.emission_amount + body.result.fee_amount)/1000000000000);
        }, params);
    } else {
      coinbase_supply(function(supply) {
        return cb(supply/100000000);
      });
    }
  },

  is_unique: function(array, object, cb) {
    var unique = true;
    var index = null;
    module.exports.syncLoop(array.length, function (loop) {
      var i = loop.iteration();
      if (array[i].addresses == object) {
        unique = false;
        index = i;
        loop.break(true);
        loop.next();
      } else {
        loop.next();
      }
    }, function(){
      return cb(unique, index);
    });
  },

  calculate_total: function(vout, cb) {
    var total = 0;
    module.exports.syncLoop(vout.length, function (loop) {
      var i = loop.iteration();
      //module.exports.convert_to_satoshi(parseFloat(vout[i].amount), function(amount_sat){
        total = total + vout[i].amount;
        loop.next();
      //});
    }, function(){
      return cb(total);
    });
  },

  prepare_vout: function(vout, txid, vin, cb) {
    var arr_vout = [];
    var arr_vin = [];
    arr_vin = vin;
    module.exports.syncLoop(vout.length, function (loop) {
      var i = loop.iteration();
      // make sure vout has an address
      if (vout[i].scriptPubKey.type != 'nonstandard' && vout[i].scriptPubKey.type != 'nulldata') { 
        // check if vout address is unique, if so add it array, if not add its amount to existing index
        //console.log('vout:' + i + ':' + txid);
        module.exports.is_unique(arr_vout, vout[i].scriptPubKey.addresses[0], function(unique, index) {
          if (unique == true) {
            // unique vout
            module.exports.convert_to_satoshi(parseFloat(vout[i].value), function(amount_sat){
              arr_vout.push({addresses: vout[i].scriptPubKey.addresses[0], amount: amount_sat});
              loop.next();
            });
          } else {
            // already exists
            module.exports.convert_to_satoshi(parseFloat(vout[i].value), function(amount_sat){
              arr_vout[index].amount = arr_vout[index].amount + amount_sat;
              loop.next();
            });
          }
        });
      } else {
        // no address, move to next vout
        loop.next();
      }
    }, function(){
      if (false) {//vout[0].scriptPubKey.type == 'nonstandard'
        if ( arr_vin.length > 0 && arr_vout.length > 0 ) {
          if (arr_vin[0].addresses == arr_vout[0].addresses) {
            //PoS
            arr_vout[0].amount = arr_vout[0].amount - arr_vin[0].amount;
            arr_vin.shift();
            return cb(arr_vout, arr_vin);
          } else {
            return cb(arr_vout, arr_vin);
          }
        } else {
          return cb(arr_vout, arr_vin);
        }
      } else {
        return cb(arr_vout, arr_vin);
      }
    });
  },

  get_input_addresses: function(input, vout, cb) {
    var addresses = [];
    if (input.coinbase) {
      var amount = 0;
      module.exports.syncLoop(vout.length, function (loop) {
        var i = loop.iteration();
          amount = amount + parseFloat(vout[i].value);  
          loop.next();
      }, function(){
        addresses.push({hash: 'coinbase', amount: amount});
        return cb(addresses);
      });
    } else {
      module.exports.get_rawtransaction(input.txid, function(tx){
        if (tx) {
          module.exports.syncLoop(tx.vout.length, function (loop) {
            var i = loop.iteration();
            if (tx.vout[i].n == input.vout) {
              //module.exports.convert_to_satoshi(parseFloat(tx.vout[i].value), function(amount_sat){
              if (tx.vout[i].scriptPubKey.addresses) {
                addresses.push({hash: tx.vout[i].scriptPubKey.addresses[0], amount:tx.vout[i].value});  
              }
                loop.break(true);
                loop.next();
              //});
            } else {
              loop.next();
            } 
          }, function(){
            return cb(addresses);
          });
        } else {
          return cb();
        }
      });
    }
  },

  prepare_vin: function(tx, cb) {
    var arr_vin = [];
    module.exports.syncLoop(tx.vin.length, function (loop) {
      var i = loop.iteration();
      module.exports.get_input_addresses(tx.vin[i], tx.vout, function(addresses){
        if (addresses && addresses.length) {
          //console.log('vin');
          module.exports.is_unique(arr_vin, addresses[0].hash, function(unique, index) {
            if (unique == true) {
              module.exports.convert_to_satoshi(parseFloat(addresses[0].amount), function(amount_sat){
                arr_vin.push({addresses:addresses[0].hash, amount:amount_sat});
                loop.next();
              });
            } else {
              module.exports.convert_to_satoshi(parseFloat(addresses[0].amount), function(amount_sat){
                arr_vin[index].amount = arr_vin[index].amount + amount_sat;
                loop.next();
              });
            }
          });
        } else {
          loop.next();
        }
      });
    }, function(){
      return cb(arr_vin);
    });
  }
};
