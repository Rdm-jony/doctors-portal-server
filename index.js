const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken')
const port = process.env.PORT || 5000;
const app = express()
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { query } = require('express');


//middle ware
app.use(cors())
app.use(express.json())

app.get("/", (req, res) => {
    res.send("doctors server running")
})



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tbsccmb.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJwt(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send("unauthorized access")
    }

    const token = authHeader.split(" ")[1]
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send("forbidden access")
        }

        req.decoded = decoded;
        next()
    })
}

const run = async () => {
    try {
        const optionCollection = client.db("doctor-portal").collection("appoinmentOptions")
        const bookingCollection = client.db("doctor-portal").collection("bookings")
        const userCollection = client.db("doctor-portal").collection("users")
        const doctorCollection = client.db("doctor-portal").collection("doctors")

        app.get("/appoinmentOptions", async (req, res) => {
            const query = {}
            const options = await optionCollection.find(query).toArray()
            const date = req.query.date;
            const bookingQuery = { date: date }
            const bookedList = await bookingCollection.find(bookingQuery).toArray()
            options.map(option => {
                const optionBooked = bookedList.filter(book => book.treatmantName === option.name)
                const optionBookedSlots = optionBooked.map(optionBook => optionBook.slot)
                const remainingSlots = option.slots.filter(slot => !optionBookedSlots.includes(slot))
                option.slots = remainingSlots;
            })
            res.send(options)
        })

        app.post("/bookings", async (req, res) => {
            const bookingInfo = req.body;
            console.log(bookingInfo)
            const query = {
                date: bookingInfo.date,
                treatmantName: bookingInfo.treatmantName,
                email: bookingInfo.email
            }
            const alreadyBooked = await bookingCollection.find(query).toArray()

            if (alreadyBooked.length !== 0) {
                const message = `This is already booked on ${bookingInfo.date}`
                return res.send({ acknowledged: false, message })
            }
            const result = await bookingCollection.insertOne(bookingInfo)
            res.send(result)
        })

        //temporary
        // app.get("/bookings",async(req,res)=>{
        //     const query={}
        //     const option={upsert:true}
        //     const updateDoc={
        //         $set:{
        //             price:99
        //         }
        //     }
        //     const result=await bookingCollection.updateMany(query,updateDoc,option)
        //     res.send(result)
        // })

        app.get("/bookings", verifyJwt, async (req, res) => {
            const query = {
                email: req.query.email
            }
            const decodedEmail = req.decoded.email
            if (decodedEmail !== req.query.email) {
                return res.status(401).send("forbidden access")
            }
            const result = await bookingCollection.find(query).toArray()
            res.send(result)
        })

        app.post("/users", async (req, res) => {
            const user = req.body;
            const result = await userCollection.insertOne(user);
            res.send(result)
        })

        app.get("/jwt", async (req, res) => {
            const email = req.query.email
            const query = {
                email: email
            }
            const result = await userCollection.findOne(query)
            if (result) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: "1h" })

                return res.send({ access_token: token })
            }
            res.status(401).send({ message: "" })
        })

        app.get("/users", async (req, res) => {
            const query = {}
            const result = await userCollection.find(query).toArray()
            res.send(result)
        })

        app.put("/users/admin/:id", verifyJwt, async (req, res) => {
            const decodedEmail = req.decoded.email;
            const query = {
                email: decodedEmail
            }
            const user = await userCollection.findOne(query)
            if (!user?.role) {
                return res.send("unathorized")
            }

            const id = req.params.id;
            const filter = {
                _id: ObjectId(id)
            }

            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    role: "admin"
                }
            }

            const result = await userCollection.updateOne(filter, updateDoc, options)
            res.send(result)
        })

        app.get("/users/admin/:email", async (req, res) => {
            const email = req.params.email;
            console.log(email)
            const query = {
                email: email
            }
            const result = await userCollection.findOne(query)
            res.send({ isAdmin: result?.role === "admin" })

        })

        app.get("/speciality", async (req, res) => {
            const query = {}
            const result = await optionCollection.find(query).project({ name: 1 }).toArray()
            res.send(result)
        })

        app.post("/doctors",async(req,res)=>{
            const doctorInfo=req.body;
            const result=await doctorCollection.insertOne(doctorInfo)
            res.send(result)
        })

        app.get("/doctors",async(req,res)=>{
            const query={}
            const result=await doctorCollection.find(query).toArray()
            res.send(result)
        })

        app.delete("/doctors/:id",async(req,res)=>{
            const id=req.params.id;
            const query={_id:ObjectId(id)}
            const result=await doctorCollection.deleteOne(query);
            res.send(result)
        })


    }
    finally {

    }
}
run().catch(er => console.log(er))


app.listen(port, () => {
    console.log(`doctors server running on ${port}`)
})