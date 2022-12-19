/** @format */

const User = require('../models/User');
const Custody = require('../models/Custody');
const CustomError = require('../errors');
const { StatusCodes } = require('http-status-codes');
const { extractUrl } = require('../utils');
const axios = require('axios');

// const {

//   authorizeRoles,
// } = require('../middleware/authentication');
const addUser = async (req, res, next) => {
  try {
    if (req.user.role === 'safety-advisor') {
      const { username, SerialNumber, idNumber, phoneNumber } = req.body;
      const { custodyId } = req.user;
      let image = {};
      const accountAlreadyExists = await User.findOne({
        username,
      });
      if (accountAlreadyExists) {
        throw new CustomError.BadRequestError('your account is already exists');
      }
      if (req.file) {
        image = await extractUrl(req.file);
      }
      const user = await User.create({
        username,
        role: 'trainer',
        SerialNumber,
        custodyId,
        idNumber,
        phoneNumber,
        image: image,
      });
      res.status(StatusCodes.CREATED).json({
        msg: '!safety-advisor added user ',
        user,
      });
    } else {
      const {
        username,
        memberShipType,
        vid,
        idNumber,
        SerialNumber,
        custodyId,
        phoneNumber,
      } = req.body;
      let image = {};
      const accountAlreadyExists = await User.findOne({
        username,
      });
      if (accountAlreadyExists) {
        throw new CustomError.BadRequestError('your account is already exists');
      }

      // first registered user is an admin

      if (req.file) {
        image = await extractUrl(req.file);
      }
      const user = await User.create({
        username,
        role: memberShipType,
        vid,
        idNumber,
        SerialNumber,
        custodyId,
        phoneNumber,
        image: image,
      });
      res.status(StatusCodes.CREATED).json({
        msg: 'admin! added user ',
        user,
      });
    }
  } catch (error) {
    next(error);
  }
};
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role == 'safety-advisor') {
      const { username, SerialNumber, idNumber, custodyId, vid, phoneNumber } =
        req.body;
      // const { custodyId } = req.user;
      const account = await User.findOne({
        _id: id,
      });
      if (account.custodyId == null || account.custodyId == custodyId) {
        account.custodyId = custodyId;
        account.save();
      } else {
        const Cus = await Custody.find({ _id: custodyId });
        Cus.pendingTrainers.push(account._id);
        Cus.save();
      }
      let image = {};
      if (req.file) {
        image = await extractUrl(req.file);
      } else {
        image.url = account.image.url;
        image.public_id = account.image.public_id;
      }

      const user = await User.findOneAndUpdate(
        { id },
        { username, SerialNumber, idNumber, vid, image: image, phoneNumber },
        { new: true, runValidators: true }
      );
      res.status(StatusCodes.CREATED).json({
        msg: '!safety-advisor updated user ',
        user,
      });
    } else {
      const {
        username,
        memberShipType,
        vid,
        idNumber,
        SerialNumber,
        custodyId,
        phoneNumber,
      } = req.body;

      let image = {};
      const account = await User.findOne({
        _id: id,
      });
      if (!account) {
        throw new CustomError.BadRequestError('your account Not exists');
      }
      // first registered user is an admin

      if (custodyId) {
        if (account.role == 'trainer') {
          if (account.custodyId == null || account.custodyId == custodyId) {
            account.custodyId = custodyId;
            account.save();
          } else {
            const Cus = await Custody.find({ _id: custodyId });
            Cus.pendingTrainers.push(account._id);
            Cus.save();
          }
        } else {
          account.custodyId = custodyId;
          account.save();
          const Cus = await Custody.find({ _id: custodyId });
          Cus.SafetyAdvisor == account._id;
          Cus.save();
        }
      }
      if (req.file) {
        image = await extractUrl(req.file);
      } else {
        image.url = account.image.url;
        image.public_id = account.image.public_id;
      }

      const user = await User.findOneAndUpdate(
        { _id: id },
        {
          username: username,
          SerialNumber,
          idNumber,
          vid,
          image: image,
          phoneNumber,
          role: memberShipType,
        },
        { new: true, runValidators: true }
      );
      res.status(StatusCodes.CREATED).json({
        msg: '!admin updated user ',
        user,
      });
    }
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};
const addCustody = async (req, res, next) => {
  try {
    const { custodyName, city, SafetyAdvisor } = req.body;
    let image = {};
    if (typeof req.body.trainerIds == 'string') {
      req.body.trainerIds = JSON.parse(req.body.trainerIds);
    }
    if (req.file) {
      image = await extractUrl(req.file);
    }
    const custody = await Custody.create({
      custodyName,
      city,
      SafetyAdvisor,
      image: image,
    });
    let updateUserToCustody = [];
    updateUserToCustody = req.body.trainerIds;
    updateUserToCustody.push(SafetyAdvisor);
    await User.updateMany(
      { _id: updateUserToCustody },
      { custodyId: custody._id }
    );
    res.status(StatusCodes.CREATED).json({
      msg: 'add Custody successfully',
      custody,
    });
  } catch (error) {
    next(error);
  }
};
const updateCustody = async (req, res, next) => {
  try {
    const { custodyName, city, SafetyAdvisor } = req.body;
    
    const custody = await Custody.findOne({ _id: req.params.id });
    if (typeof req.body.trainerIds == 'string') {
      req.body.trainerIds = JSON.parse(req.body.trainerIds);
    }
    let image = {};
    let oldtrainers = [];
    if (req.file) {
      image = await extractUrl(req.file);
    } else {
      image.url = custody.image.url;
      image.public_id = custody.image.public_id;
    }
    if(req.body.trainerIds){
        const newTrainers =  await User.find({_id : req.body.trainerIds })
        let oldUsers = await User.find({ custodyId: req.params.id ,role : "trainer"}, { _id: 1 });
          oldUsers.forEach((e) => oldtrainers.push(e._id));
              let difference = oldtrainers.filter(
              (x) => !req.body.trainerIds.toString().includes(x.toString())
              );
              await User.updateMany({ _id: difference }, { custodyId: null })
          newTrainers.forEach(element => {
            if(element.custodyId != null && element.custodyId != custody._id ) {
              custody.pendingTrainers.push(element._id)
            }
            else {
                element.custodyId = custody._id
                element.save()
            }
          });
          custody.save()
        }
 
    const updatedCustody = await Custody.findOneAndUpdate(
      { _id: req.params.id },
      {
        custodyName,
        city,
        SafetyAdvisor,
        image: image,
      },
      { new: true, runValidators: true }
    );
    if(SafetyAdvisor){
      const saftey =  await User.findOne({_id:SafetyAdvisor})
      const oldSaftey =  await User.findOne({ custodyId: req.params.id ,role : "safety-advisor"})
      if(saftey.custodyId !=  oldSaftey.custodyId ){
          saftey.custodyId = custody._id
          oldSaftey.custodyId = null
      }
    await  saftey.save();
    await  oldSaftey.save();
    }
    return res.status(200).json({ msg : "Custody updated successfully",updatedCustody });
  } catch (error) {
    next(error);
  }
};

const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find({ role: { $ne: 'admin' } });
    res.status(StatusCodes.OK).json({ users });
  } catch (error) {
    next(error);
  }
};

const getallCustodys = async (req, res, next) => {
  try {
    let agg = [
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: 'custodyId',
          as: 'users',
        },
      },

      {
        $project: {
          users: {
            $filter: {
              input: '$users',
              as: 'user',
              cond: { $eq: ['$$user.role', 'trainer'] },
            },
          },
          custodyName: 1,
          pendingTrainers: 1,
          SafetyAdvisor: 1,
          city: 1,
          image: 1,
        },
      },
    ];
    const custody = await Custody.aggregate(agg);
    await Custody.populate(custody, { path: 'SafetyAdvisor pendingTrainers' });
    res.status(StatusCodes.OK).json({ custody });
  } catch (error) {
    next(error);
  }
};
const getAllTrainers = async (req, res, next) => {
  try {
    const users = await User.find({ role: 'trainer' });
    res.status(StatusCodes.OK).json({ users });
  } catch (error) {
    next(error);
  }
};
const getAllSafetyAdvisor = async (req, res, next) => {
  try {
    const users = await User.find({ role: 'safety-advisor' });
    res.status(StatusCodes.OK).json({ users });
  } catch (error) {
    next(error);
  }
};
const CustodyDetails = async (req, res, next) => {
  try {
    let agg = [
      {
        $match: { custodyName: req.body.custodyName },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: 'custodyId',
          as: 'users',
        },
      },
      {
        $project: {
          users: {
            $filter: {
              input: '$users',
              as: 'user',
              cond: { $eq: ['$$user.role', 'trainer'] },
            },
          },
          custodyName: 1,
          pendingTrainers: 1,
          SafetyAdvisor: 1,
          city: 1,
          image: 1,
        },
      },
    ];
    // const custodyDetails = await Custody.aggregate(agg).populate('SafetyAdvisor');
    const custodyDetails = await Custody.aggregate(agg);
    await Custody.populate(custodyDetails, {
      path: 'SafetyAdvisor pendingTrainers',
    });
    res.status(StatusCodes.OK).json({ custodyDetails });
  } catch (error) {
    next(error);
  }
};
const getCustodyByCity = async (req, res, next) => {
  try {
    let agg = [
      {
        $match: { city: req.body.city },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: 'custodyId',
          as: 'users',
        },
      },
      {
        $project: {
          users: {
            $filter: {
              input: '$users',
              as: 'user',
              cond: { $eq: ['$$user.role', 'trainer'] },
            },
          },
          custodyName: 1,
          pendingTrainers: 1,
          SafetyAdvisor: 1,
          city: 1,
          image: 1,
        },
      },
    ];
    // const custodyDetails = await Custody.aggregate(agg).populate('SafetyAdvisor');
    const custodyDetails = await Custody.aggregate(agg);
    await Custody.populate(custodyDetails, {
      path: 'SafetyAdvisor pendingTrainers',
    });
    res.status(StatusCodes.OK).json({ custodyDetails });
  } catch (error) {
    next(error);
  }
};
const getsafteyAdvisorCustody = async (req, res, next) => {
  try {
    const { ObjectId } = require('mongoose').Types;

    let agg = [
      {
        $match: { _id: new ObjectId(req.user.custodyId) },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: 'custodyId',
          as: 'users',
        },
      },
      {
        $project: {
          users: {
            $filter: {
              input: '$users',
              as: 'user',
              cond: { $eq: ['$$user.role', 'trainer'] },
            },
          },
          custodyName: 1,
          pendingTrainers: 1,
          SafetyAdvisor: 1,
          city: 1,
          image: 1,
        },
      },
    ];
    const data = await Custody.aggregate(agg);
    await Custody.populate(data, {
      path: 'SafetyAdvisor pendingTrainers',
    });
    res.status(StatusCodes.OK).json({ data });
  } catch (error) {
    console.log(error);
    next(error);
  }
};
const getProfile = async (req, res, next) => {
  try {
    const data = await User.find({ _id: req.user.userId });
    res.status(StatusCodes.OK).json({ data });
  } catch (error) {
    next(error);
  }
};
const getHomeStatistics = async (req, res, next) => {
  try {
    res.status(StatusCodes.OK).json({
      onlineUsers: 20,
      offlineUsers: 15,
      totalMillage: 1229,
      SafetyAdvisor: 10,
      totalUsers: 45,
    });
  } catch (error) {
    next(error);
  }
};
const addRequest = async (req, res, next) => {
  try {
    let waitingTrainer = [];
    const { username, to } = req.body;
    const user = await User.findOne({ username: username });
    const custody = await Custody.findOne({ _id: to });
    if (user.custodyId == null) {
      throw new Error("you can't add request for new trainers");
    }
    waitingTrainer = custody.pendingTrainers;
    waitingTrainer.push(user._id);
    await Custody.findByIdAndUpdate(to, { pendingTrainers: waitingTrainer });
    res.status(StatusCodes.OK).json({ msg: 'add request successfully' });
  } catch (error) {
    next(error);
  }
};
const resForRequest = async (req, res, next) => {
  const { responce, trainerId, custodyId } = req.body;
  try {
    if (responce == 'accept') {
      let trainer = await User.findOne({
        _id: trainerId,
      });
      let custody = await Custody.findOne({ _id: custodyId });
      let findTr = custody.pendingTrainers.findIndex(
        (e) => e._id.toString() == trainerId
      );
      if (findTr > -1) {
        custody.pendingTrainers.splice(findTr, 1);
        trainer.custodyId = custodyId;
      } else {
        return res.status(200).json({ msg: "you can't added on this group" });
      }
      trainer.save();
      custody.save();
      res.status(200).json({ msg: 'accepted req' });
    } else if (responce == 'refuse') {
      let custody = await Custody.findOne({ _id: custodyId });
      let findTr = custody.pendingTrainers.findIndex(
        (e) => e._id.toString() == trainerId
      );
      if (findTr > -1) {
        custody.pendingTrainers.splice(findTr, 1);
      }
      custody.save();
      res.status(200).json({ msg: 'reject req' });
    } else {
      throw new Error('please try again');
    }
  } catch (error) {
    next(error);
  }
};
const freeSaftey = async (req, res, next) => {
  try {
    const safety = await User.find({
      custodyId: null,
      role: { $eq: 'safety-advisor' },
    });
    res.status(StatusCodes.OK).json({ safety });
  } catch (error) {
    next(error);
  }
};
const getPendingTrainers = async (req, res, next) => {
  const { custodyId } = req.body;
  const data = await Custody.findOne({ _id: custodyId }).populate(
    'pendingTrainers'
  );
  res.status(200).json({ data });
};

const Vehicle = async (req, res, next) => {
  const config = {
    headers: {
      Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImVhMjM3NWM3LWZkMjAtNDYyOC1hNDg0LTc1MWE2NTgyZTA1NiIsInVzZXJuYW1lIjoidGQiLCJleHAiOjE2NzY1MzYwMDYsImFjY291bnRJZCI6MzY2LCJyb2xlIjoidXNlciIsImlhdCI6MTY3MTM1MjAwNn0.HpEzqi1BcF4ZJyjqkDwUh0wcZt26beqkyPNXz91shfI`,
    },
  };
  const getAllVech = await User.find(
    { SerialNumber: { $ne: null } },
    { SerialNumber: 1, _id: 0 }
  );
  const data = await axios
    .get('https://api.v6.saferoad.net/dashboard/vehicles', config)
    .then((apiResponse) => {
      // process the response
      return apiResponse.data;
    });
  data.Vehicles = data.Vehicles.filter((veh) => {
    return !getAllVech.some((g) => g.SerialNumber == veh.SerialNumber);
  });
  res.send(data.Vehicles);
};
module.exports = {
  addUser,
  addCustody,
  getAllUsers,
  getAllTrainers,
  getAllSafetyAdvisor,
  CustodyDetails,
  getCustodyByCity,
  getallCustodys,
  updateCustody,
  getsafteyAdvisorCustody,
  getProfile,
  getHomeStatistics,
  addRequest,
  resForRequest,
  updateUser,
  freeSaftey,
  getPendingTrainers,
  Vehicle,
};
