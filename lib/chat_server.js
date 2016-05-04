var socketio=require("socket.io");
var io;
var guestNumber=1;
var nickNames={};
var namesUsed=[];
var currentRoom={};

exports.listen=function(server){
	io=socketio.listen(server);
	io.set('log level',1);
	io.sockets.on('connection',function(socket){
		guestNumber=assignGuestName(socket,guestNumber,nickNames,namesUsed);
		joinRoom(socket,'南爸爸的家');
		handleMessageBroadcasting(socket,nickNames);
		handleNameChangeAttempts(socket,nickNames,namesUsed);
		handleRoomJoining(socket);
		socket.on('rooms',function(){
			socket.emit('rooms',io.sockets.manager.rooms);
		});
		handleClientDisconnection(socket,nickNames,namesUsed);
	});
}

function assignGuestName(socket,guestNumber,nickNames,namesUsed){
	var name='南爸爸的儿子'+guestNumber+'号';
	nickNames[socket.id]=name;
	socket.emit('nameResult',{
		success:true,
		name:name
	});
	namesUsed.push(name);
	return guestNumber+1;
}

function joinRoom(socket,room){
	socket.join(room);
	currentRoom[socket.id]=room;
	socket.emit('joinResult',{room:room});
	socket.broadcast.to(room).emit('message',{
		text:nickNames[socket.id]+' 进入 '+room+'.'
	});
	var usersInRoom=io.sockets.clients(room);
	if(usersInRoom.length>1){
		var usersInRoomSummary='在 '+room+' 的儿子有: ';
		for(var index in usersInRoom){
			var userSocketId=usersInRoom[index].id;
			if(userSocketId!=socket.id){
				if(index>0){
					usersInRoomSummary+=', ';
				}
				usersInRoomSummary+=nickNames[userSocketId];
			}
		}
		usersInRoomSummary+='。';
		socket.emit('message',{text:usersInRoomSummary});
	}
}

function handleNameChangeAttempts(socket, nickNames, namesUsed) {
	socket.on('nameAttempt', function(name) {　　//添加nameAttempt事件的监听器
		if (name.indexOf('南爸爸的儿子') == 0) {  //昵称不能以 “南爸爸的儿子” 开头
			socket.emit('nameResult', {
				success: false,
				message: '更改的昵称不能以 “南爸爸的儿子” 开头。'
			});
		} else {
			if (namesUsed.indexOf(name) == -1) {  //如果昵称还没注册就注册上
				var previousName = nickNames[socket.id];
				var previousNameIndex = namesUsed.indexOf(previousName);
				namesUsed.push(name);
				nickNames[socket.id] = name;
				delete namesUsed[previousNameIndex];  //删掉之前用的昵称，让其他用户可以使用
					socket.emit('nameResult', {
					success: true,
					name: name
				});
				socket.broadcast.to(currentRoom[socket.id]).emit('message', {
				text: previousName + ' 更改昵称为 ' + name + '。'
				});
			} else {
				socket.emit('nameResult', {  //如果昵称已经被占用，给客户端发送错误消息
					success: false,
					message: '该昵称已被使用。'
				});
			}
		}
	});
}

function handleMessageBroadcasting(socket) {
	socket.on('message', function (message) {
		socket.broadcast.to(message.room).emit('message', {
			text: nickNames[socket.id] + ': ' + message.text
		});
	});
}

function handleRoomJoining(socket) {
	socket.on('join', function(room) {
		socket.leave(currentRoom[socket.id]);
		joinRoom(socket, room.newRoom);
	});
}

function handleClientDisconnection(socket) {
	socket.on('disconnect', function() {
		var nameIndex = namesUsed.indexOf(nickNames[socket.id]);
		delete namesUsed[nameIndex];
		delete nickNames[socket.id];
	});
}