const Task = require('../models/task');
const User = require('../models/user');
const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        let query = Task.find(JSON.parse(req.query.where || '{}'))
            .sort(JSON.parse(req.query.sort || '{}'))
            .select(JSON.parse(req.query.select || '{}'))
            .skip(parseInt(req.query.skip) || 0);

        if (req.query.limit) {
            query = query.limit(parseInt(req.query.limit));
        }

        if (req.query.count === 'true') {
            const count = await Task.countDocuments(JSON.parse(req.query.where || '{}'));
            return res.status(200).json({ message: "Success", data: count });
        }

        const tasks = await query.exec();
        res.status(200).json({ message: "Success", data: tasks });
    } catch (error) {
        res.status(500).json({ message: "Server Error", data: error });
    }
});

router.post('/', async (req, res) => {
    try {
        const newTaskData = req.body;

        if (newTaskData.assignedUser) {
            const user = await User.findById(newTaskData.assignedUser);

            if (!user) {
                return res.status(400).json({ message: "Bad request: assigned user not found", data: newTaskData });
            }

            newTaskData.assignedUserName = user.name;
        }

        const newTask = new Task(newTaskData);
        await newTask.save();

        if (newTask.assignedUser && !newTaskData.completed) {
            await User.findByIdAndUpdate(newTask.assignedUser, { $push: { pendingTasks: newTask._id } });
        }

        res.status(201).json({ message: "Created", data: newTask });
    } catch (error) {
        res.status(400).json({ message: "Server Error", data: error });
    }
});


router.get('/:id', async (req, res) => {
    try {
        const task = await Task.findById(req.params.id).select(JSON.parse(req.query.select || '{}'));
        if (task) {
            res.status(200).json({ message: "Success", data: task });
        }
        else {
            res.status(404).json({ message: "Task not found", data: null });
        }
    } catch (error) {
        res.status(500).json({ message: "Server Error", data: error });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const updatedTaskData = req.body;
        let updatedTask;

        const existingTask = await Task.findById(req.params.id);
        if (!existingTask) {
            return res.status(404).json({ message: "Task not found", data: null });
        }

        if (updatedTaskData.assignedUser == "") {
            updatedTaskData.assignedUserName = "unassigned";
        }

        if (updatedTaskData.assignedUser && updatedTaskData.assignedUser !== "") {
            const user = await User.findById(updatedTaskData.assignedUser);

            if (!user) {
                return res.status(400).json({ message: "Bad request: assigned user not found", data: updatedTaskData });
            }

            updatedTaskData.assignedUserName = user.name;
        }

        if (existingTask.assignedUser !== "" && existingTask.assignedUser.toString() !== updatedTaskData.assignedUser.toString()) {
            await User.findByIdAndUpdate(existingTask.assignedUser, { $pull: { pendingTasks: existingTask._id } });
        }

        updatedTask = await Task.findByIdAndUpdate(req.params.id, updatedTaskData, { new: true, runValidators: true });

        if (updatedTask) {
            if (updatedTaskData.assignedUser) {
                await User.findByIdAndUpdate(updatedTaskData.assignedUser, { $addToSet: { pendingTasks: updatedTask._id } });
            }
            res.status(200).json({ message: "Success", data: updatedTask });
        } else {
            res.status(404).json({ message: "Task not found", data: null });
        }
    } catch (error) {
        res.status(500).json({ message: "Server Error", data: error });
    }
});



router.delete('/:id', async (req, res) => {
    try {
        const deletedTask = await Task.findByIdAndDelete(req.params.id);

        if (deletedTask) {
            await User.findOneAndUpdate({ _id: deletedTask.assignedUser }, { $pull: { pendingTasks: deletedTask._id } });
            res.status(200).json({ message: "Deleted", data: deletedTask });
        } else {
            res.status(404).json({ message: "Task not found", data: null });
        }
    } catch (error) {
        res.status(500).json({ message: "Server Error", data: error });
    }
});

module.exports = router;