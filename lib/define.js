var base = require("./base"), toArray = base.array.toArray, merge = base.merge, profiler = require("profiler");

/**
 * Used to keep track of classes and to create unique ids
 * @ignore
 */
var classCounter = 0;

var functionWrapper = function (f, name, supers) {
    var wrapper = function () {
        var orgSuper = this._super, ret;
        if (this.__meta) {
            var supers = this.__meta.supers, l = supers.length, pos = 0;
            if (l) {
                this._super = function (args, a) {
                    if (a) {
                        args = a;
                    }
                    var m;
                    while (!m && pos < l) {
                        var sup = supers[pos++], m = sup[name];
                        if (m && (m = m._f || m) && "function" === typeof m && m !== f) {
                            break;
                        } else {
                            m = null;
                        }
                    }
                    if (m) {
                        return m.apply(this, args);
                    } else {
                        return null;
                    }
                };
            } else {
                this._super = function () {
                    return null;
                };
            }
            ret = f.apply(this, arguments);
            this._super = orgSuper || null;
        } else {
            ret = f.apply(this, arguments);
        }
        return ret;
    }
    wrapper._f = f;
    return wrapper;
};


/**
 * @ignore
 */
var defineMixinProps = function (child, proto) {
    if (proto) {
        var operations = proto.setters;
        if (operations) {
            for (var i in operations) {
                if (!child.__lookupSetter__(i)) {  //make sure that the setter isnt already there
                    child.__defineSetter__(i, operations[i]);
                }
            }
        }
        operations = proto.getters;
        if (operations) {
            for (i in operations) {
                if (!child.__lookupGetter__(i)) {
                    //define the getter if the child does not already have it
                    child.__defineGetter__(i, operations[i]);
                }
            }
        }
        if (proto) {
            for (var j in proto) {
                if (j != "getters" && j != "setters") {
                    var p = proto[j];
                    if ("function" === typeof p) {
                        if (!child.hasOwnProperty(j)) {
                            child[j] = functionWrapper(defaultFunction, j);
                        }
                    } else {
                        child[j] = p;
                    }
                }
            }
        }
    }
};

/**
 * @ignore
 */
var mixin = function () {
    var args = Array.prototype.slice.call(arguments);
    var child = this.prototype, bases = child.__meta.bases, staticBases = bases.slice(), constructor = child.constructor;
    for (var i = 0; i < args.length; i++) {
        var m = args[i];
        defineMixinProps(child, m.prototype.__meta.proto, constructor._unique);
        defineMixinProps(this, m.__meta.proto, constructor._unique);
        //copy the bases for static,
        var staticSupers = this.__meta.supers, supers = child.__meta.supers;
        child.__meta.supers = mixinSupers(m.prototype, bases).concat(supers);
        this.__meta.supers = mixinSupers(m, staticBases).concat(staticSupers);
    }
    return this;
};

/**
 * @ignore
 */
var mixinSupers = function (sup, bases) {
    var arr = [], unique = sup.__meta.unique;
    //check it we already have this super mixed into our prototype chain
    //if true then we have already looped their supers!
    if (bases.indexOf(unique) == -1) {
        //add their id to our bases
        bases.push(unique);
        arr.push(sup);
        var supers = sup.__meta.supers, l = supers.length;
        if (supers && l) {
            for (var i = 0; i < l; i++) {
                arr = arr.concat(mixinSupers(supers[i], bases));
            }
        }
    }
    return arr;
};


/**
 * @ignore
 */
var defineProps = function (child, proto) {
    if (proto) {
        var operations = proto.setters;
        if (operations) {
            for (var i in operations) {
                child.__defineSetter__(i, operations[i]);
            }
        }
        operations = proto.getters;
        if (operations) {
            for (i in operations) {
                child.__defineGetter__(i, operations[i]);
            }
        }
        var constructorFound = false;
        for (i in proto) {
            if (i != "getters" && i != "setters") {
                var f = proto[i];
                if ("function" === typeof f) {
                    var meta = f.__meta || {};
                    if (!meta.isConstructor) {
                        child[i] = functionWrapper(f, i);
                    }else{
                        child[i] = f;
                    }
                } else {
                    child[i] = f;
                }
            }
        }
    }
};

var defaultFunction = function () {
    return this._super(arguments);
};

var _export = function (obj, name) {
    if (obj && name) {
        obj[name] = this;
    } else {
        obj.exports = obj = this;
    }
    return this;
};


/**
 * @ignore
 */
var __define = function (child, sup, proto) {
    proto = proto || {};
    var childProto = child.prototype, supers = [];
    if (sup) {
        supers = toArray(sup);
        sup = supers.shift();
    } else {
        supers = [];
    }
    var unique = "define" + classCounter, bases = [], staticBases = [];
    var instanceSupers = [], staticSupers = [];
    if (sup) {
        child.__proto__ = sup;
        childProto.__proto__ = sup.prototype;
        instanceSupers = mixinSupers(sup.prototype, bases), staticSupers = mixinSupers(sup, staticBases);

    }
    var meta = childProto.__meta = {
        supers:instanceSupers,
        superName:"",
        unique:unique,
        bases:bases
    };
    var childMeta = child.__meta = {
        supers:staticSupers,
        superName:"",
        unique:unique,
        bases:staticBases,
        isConstructor:true
    };
    childProto._static = child;
    var instance = meta.proto = merge({constructor:defaultFunction}, proto.instance || {});
    var stat = childMeta.proto = merge({init:defaultFunction}, proto.static || {});
    defineProps(childProto, instance, false);
    defineProps(child, stat, true);
    if (supers.length) {
        mixin.apply(child, supers);
    }
    child.mixin = mixin;
    child.as = _export;
    classCounter++;
    return child;
};


merge(exports, {
    /**@lends comb*/

    /**
     * Defines a new class to be used
     *
     * <p>
     *     Class methods
     *     <ul>
     *         <li>as(module | bject, name): exports the object to module or the object with the name</li>
     *         <li>mixin(mixin) : mixes in an object</li>
     *     </ul>
     *     </br>
     *     Instance methods
     *     <ul>
     *         <li>_super(argumnents, [?newargs]): calls the super of the current method</li>
     *     </ul>
     *
     *      </br>
     *     Instance properties
     *     <ul>
     *         <li>_static: use to reference class properties and methods</li>
     *     </ul>
     *
     * </p>
     *
     *
     * @example
     *  //Class without a super class
     * var Mammal = comb.define(null, {
     *      instance : {
     *
     *          constructor: function(options) {
     *              options = options || {};
     *              this._super(arguments);
     *              this._type = options.type || "mammal";
     *          },
     *
     *          speak : function() {
     *              return  "A mammal of type " + this._type + " sounds like";
     *          },
     *
     *          //Define your getters
     *          getters : {
     *              type : function() {
     *                  return this._type;
     *              }
     *          },
     *
     *           //Define your setters
     *          setters : {
     *              type : function(t) {
     *                  this._type = t;
     *              }
     *          }
     *      },
     *
     *      //Define your static methods
     *      static : {
     *          soundOff : function() {
     *              return "Im a mammal!!";
     *          }
     *      }
     * });
     *
     * //Show singular inheritance
     *var Wolf = comb.define(Mammal, {
     *   instance: {
     *       constructor: function(options) {
     *          options = options || {};
     *          //You can call your super constructor, or you may not
     *          //call it to prevent the super initializing parameters
     *          this._super(arguments);
     *          this._sound = "growl";
     *          this._color = options.color || "grey";
     *      },
     *
     *      speak : function() {
     *          //override my super classes speak
     *          //Should return "A mammal of type mammal sounds like a growl"
     *          return this._super(arguments) + " a " + this._sound;
     *      },
     *
     *      //add new getters for sound and color
     *      getters : {
     *
     *          color : function() {
     *              return this._color;
     *          },
     *
     *          sound : function() {
     *              return this._sound;
     *          }
     *      },
     *
     *      setters : {
     *
     *          //NOTE color is read only except on initialization
     *
     *          sound : function(s) {
     *              this._sound = s;
     *          }
     *      }
     *
     *  },
     *
     *  static : {
     *      //override my satic soundOff
     *      soundOff : function() {
     *          //You can even call super in your statics!!!
     *          //should return "I'm a mammal!! that growls"
     *          return this._super(arguments) + " that growls";
     *      }
     *  }
     *});
     *
     *
     * //Typical hierarchical inheritance
     * // Mammal->Wolf->Dog
     * var Dog = comb.define(Wolf, {
     *    instance: {
     *        constructor: function(options) {
     *            options = options || {};
     *            this._super(arguments);
     *            //override Wolfs initialization of sound to woof.
     *            this._sound = "woof";
     *
     *        },
     *
     *        speak : function() {
     *            //Should return "A mammal of type mammal sounds like a growl thats domesticated"
     *            return this._super(arguments) + " thats domesticated";
     *        }
     *    },
     *
     *    static : {
     *        soundOff : function() {
     *            //should return "I'm a mammal!! that growls but now barks"
     *            return this._super(arguments) + " but now barks";
     *        }
     *    }
     *});
     *
     *
     *
     * dog instanceof Wolf => true
     * dog instanceof Mammal => true
     * dog.speak() => "A mammal of type mammal sounds like a woof thats domesticated"
     * dog.type => "mammal"
     * dog.color => "gold"
     * dog.sound => "woof"
     * Dog.soundOff() => "Im a mammal!! that growls but now barks"
     *
     * // Mammal->Wolf->Dog->Breed
     *var Breed = comb.define(Dog, {
     *    instance: {
     *
     *        //initialize outside of constructor
     *        _pitch : "high",
     *
     *        constructor: function(options) {
     *            options = options || {};
     *            this._super(arguments);
     *            this.breed = options.breed || "lab";
     *        },
     *
     *        speak : function() {
     *            //Should return "A mammal of type mammal sounds like a
     *            //growl thats domesticated with a high pitch!"
     *            return this._super(arguments) + " with a " + this._pitch + " pitch!";
     *        },
     *
     *        getters : {
     *            pitch : function() {
     *                return this._pitch;
     *            }
     *        }
     *    },
     *
     *    static : {
     *        soundOff : function() {
     *            //should return "I'M A MAMMAL!! THAT GROWLS BUT NOW BARKS!"
     *            return this._super(arguments).toUpperCase() + "!";
     *        }
     *    }
     * });
     *
     *
     * var breed = new Breed({color : "gold", type : "lab"}),
     *
     *
     *
     * breed instanceof Dog => true
     * breed instanceof Wolf => true
     * breed instanceof Mammal => true
     * breed.speak() => "A mammal of type lab sounds like a woof "
     *                  + "thats domesticated with a high pitch!"
     * breed.type => "lab"
     * breed.color => "gold"
     * breed.sound => "woof"
     * breed.soundOff() => "IM A MAMMAL!! THAT GROWLS BUT NOW BARKS!"
     *
     *
     *  //Example of multiple inheritance
     *  //NOTE proto is optional
     *
     *  //Mammal is super class
     *  //Wolf Dog and Breed inject functionality into the prototype
     * var Lab = comb.define([Mammal, Wolf, Dog, Breed]);
     *
     * var lab = new Lab();
     * lab instanceof Wolf => false
     * lab instanceof Dog => false
     * lab instanceof Breed => false
     * lab instanceof Mammal => true
     * lab.speak() => "A mammal of type mammal sounds like a"
     *                + " woof thats domesticated with a high pitch!"
     * Lab.soundOff() => "IM A MAMMAL!! THAT GROWLS BUT NOW BARKS!"
     *
     * @param {Array|Class} super the supers of this class
     * @param {Object} [proto] the object used to define this class
     * @param {Object} [proto.instance] the instance methods of the class
     * @param {Object} [proto.instance.getters] the getters for the class
     * @param {Object} [proto.instance.setters] the setters for the class
     * @param {Object} [proto.static] the Class level methods of this class
     * @param {Object} [proto.static.getters] static getters for the object
     * @param {Object} [proto.static.setters] static setters for the object
     *
     * @returns {Object} the constructor of the class to be used with new keyword
     */
    define:function (sup, proto) {
        proto = proto || {};
        var child = function () {
            this.constructor.apply(this, arguments);
        };
        var ret = __define(child, sup, proto);
        if (typeof ret.init === "function") {
            ret = ret.init() || ret;
        }
        return ret;
    },

    /**
     * Defines a singleton instance of a Class
     * @example
     *  var MyLab = comb.singleton([Mammal, Wolf, Dog, Breed]);
     *  var myLab1 = new MyLab();
     *  myLab1.type = "collie"
     *  var myLab2 = new MyLab();
     *  myLab1 === myLab2 => true
     *  myLab1.type => "collie"
     *  myLab2.type => "collie"
     * See {@link define}
     */
    singleton:function (sup, proto) {
        var retInstance;
        proto = proto || {};
        var child = function () {
            if (!retInstance) {
                this.constructor.apply(this, arguments);
                retInstance = this;
            }
            return retInstance;
        };
        var ret = __define(child, sup, proto);
        if (typeof ret.init === "function") {
            ret = ret.init() || ret;
        }
        return ret;
    }
});