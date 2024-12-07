const User = require('../models/user');
const Task = require('../models/task');
const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        let query = User.find(JSON.parse(req.query.where || '{}'))
            .sort(JSON.parse(req.query.sort || '{}'))
            .select(JSON.parse(req.query.select || '{}'))
            .skip(parseInt(req.query.skip) || 0);

        if (req.query.limit) {
            query = query.limit(parseInt(req.query.limit));
        }

        if (req.query.count === 'true') {
            const count = await User.countDocuments(JSON.parse(req.query.where || '{}'));
            return res.status(200).json({ message: "Success", data: count });
        }

        const users = await query.exec();
        res.status(200).json({ message: "Success", data: users });
    } catch (error) {
        res.status(500).json({ message: "Server Error", data: error });
    }
});

router.post('/', async (req, res) => {
    try {
        const newUser = new User(req.body);

        const savedUser = await newUser.save();

        if (savedUser.pendingTasks.length > 0) {
            await Task.updateMany(
                { _id: { $in: savedUser.pendingTasks } },
                {
                    assignedUser: savedUser._id.toString(),
                    assignedUserName: savedUser.name
                }
            );
        }

        res.status(201).json({ message: "Created", data: savedUser });
    } catch (error) {
        res.status(400).json({ message: "Bad Request", data: error });
    }
});


router.get('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select(JSON.parse(req.query.select || '{}'));
        if (user) {
            res.status(200).json({ message: "Success", data: user });
        }
        else {
            res.status(404).json({ message: "User not Found", data: null });
        }
    } catch (error) {
        res.status(500).json({ message: "Server Error", data: error });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const currentUser = await User.findById(req.params.id);
        if (!currentUser) {
            return res.status(404).json({ message: "User not Found", data: null });
        }

        const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });

        if (updatedUser) {
            const currentPendingTasks = new Set(currentUser.pendingTasks.map(task => task.toString()));
            const updatedPendingTasks = new Set(updatedUser.pendingTasks.map(task => task.toString()));

            const tasksToRemoveUser = [...currentPendingTasks].filter(task => !updatedPendingTasks.has(task));

            if (tasksToRemoveUser.length > 0) {
                await Task.updateMany(
                    { _id: { $in: tasksToRemoveUser } },
                    {
                        assignedUser: "",
                        assignedUserName: "unassigned"
                    }
                );
            }

            if (updatedUser.pendingTasks.length > 0) {
                await Task.updateMany(
                    { _id: { $in: updatedUser.pendingTasks } },
                    {
                        assignedUser: updatedUser._id.toString(),
                        assignedUserName: updatedUser.name
                    }
                );
            }

            res.status(200).json({ message: "Success", data: updatedUser });
        }
    } catch (error) {
        res.status(500).json({ message: "Server Error", data: error });
    }
});


router.delete('/:id', async (req, res) => {
    try {
        const userToDelete = await User.findById(req.params.id);
        if (!userToDelete) {
            return res.status(404).json({ message: "User not Found", data: null });
        }

        await Task.updateMany(
            { assignedUser: userToDelete._id.toString(), _id: { $in: userToDelete.pendingTasks } },
            { assignedUser: "", assignedUserName: "unassigned" }
        );

        const deletedUser = await User.findByIdAndDelete(req.params.id);

        res.status(200).json({ message: "Deleted", data: deletedUser });
    } catch (error) {
        res.status(500).json({ message: "Server Error", data: error });
    }
});


module.exports = router;