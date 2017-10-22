(function()
{
	"use strict";

	var last_message_id = null;
	var is_owner_of_last_msg = false;

	//jQuery elements
	var $chat_body = $('.chat_body');
	var $chat_form = $('#chat_form');
	var $chat_input = $('#chat_input');
	var $name_btn = $('#name_btn');

	var private_token = localStorage.getItem("private_token");
	var public_token = localStorage.getItem("public_token");
	var user_name = localStorage.getItem("user_name");

	var is_authed = false;

	if (user_name !== null)
	{
		$name_btn.html(user_name);
	}

	//TODO this should really use https (does python port support?)
	//io(https://[...], {secure: true})
	var socket = io('http://comp2772.nm.tc:8080/chat');

	socket.on('connect', function()
	{
		if (private_token !== null)
		{
			socket.emit('auth',
			{
				'private_token': private_token,
				'public_token': public_token
			}, function(data)
			{
				if (data.OK === true)
				{
					is_authed = true;
				}
				else
				{
					//if the old auth token is invalid the server will send new ones
					if (data.hasOwnProperty('private_token'))
					{
						private_token = data.private_token;
						public_token = data.public_token;
						is_authed = true;

						localStorage.setItem('private_token', private_token);
						localStorage.setItem('public_token', public_token);
					}
					else
					{
						$chat_body.after('<div class="chat_error">Could not reauthenticate with server</div>');
					}
				}

				if (is_authed)
				{
					//Request old name (usually this just double checks saved username)
					socket.emit('name_request',
					{
						'name_request': user_name
					}, function(data)
					{
						if (data.OK === true)
						{
							user_name = data.name;
							localStorage.setItem('user_name', user_name);
							$chat_input.focus();
							$name_btn.html(user_name);
						}
						else
						{
							//Old name refused, get a new one
							request_random_name();
						}
					});
				}

			});
		}
		else
		{
			socket.emit('auth',
			{
				'New Session': 'true'
			}, function(data)
			{
				if (data.hasOwnProperty('private_token'))
				{
					private_token = data.private_token;
					public_token = data.public_token;
					is_authed = true;

					localStorage.setItem('private_token', private_token);
					localStorage.setItem('public_token', public_token);

					if (is_authed && user_name === null)
					{
						//Request a new name
						request_random_name();
					}
				}
				else
				{
					$chat_body.after('<div class="chat_error">Could not authenticate with server</div>');
				}
			});
		}

	});
	//on('connect_error')
	//display error
	//clear error on reconnect

	function request_random_name()
	{
		//Request a random name
		socket.emit('name_request',
		{
			'name_request': true
		}, function(data)
		{
			if (data.OK === true)
			{
				user_name = data.name;
				localStorage.setItem('user_name', user_name);
				$chat_input.focus();
				$name_btn.html(user_name);
			}
		});
	}


	//We receive a chat message from another user
	socket.on('chat_message', function(data)
	{
		add_message(data);

	});

	function add_message(data)
	{
		var is_msg_owner = data.public_token == public_token;
		
		var output;
		if (data.connect_to_id && $("#" + data.connect_to_id).length > 0)
		{
			output = new_chat_message(data.msg, data.msg_id, is_msg_owner);
			$("#" + data.connect_to_id).after(output);
		}
		else
		{
			output = new_message_group(data.user, data.time, data.msg, data.msg_id, is_msg_owner);
			$chat_body.append(output);
		}

		is_owner_of_last_msg = is_msg_owner;
		if (is_msg_owner && last_message_id == data.connect_to_id)
		{
			last_message_id = data.msg_id
		}
		scroll_down_chat();
	}

	function new_message_group(name, timestamp, chat_message, msg_id, is_owner, extra_classes)
	{
		var first_message_html = new_chat_message(chat_message, msg_id, is_owner, extra_classes);

		var time = new Date(timestamp).toLocaleString('en-US',
		{
			hour: 'numeric',
			minute: 'numeric',
			hour12: true
		});

		if (is_owner)
		{
			extra_classes += ' chat_message_owner';
		}

		//find the first alphabet chactacter https://stackoverflow.com/a/23632145
		var first_letter = name.match(/[a-zA-Z]/).pop();

		if (first_letter === null)
			first_letter = name.charAt[0];

		first_letter = first_letter.toUpperCase();


		var color_code = 'rgb(0,0,0)';

		if (first_letter in color_map)
		{
			color_code = color_map[first_letter];
		}

		//Strings are slightly slower but making complicated dom elements gives me the shits
		var html = "<div class=\"chat_message_group " + extra_classes + "\">" +
                        "<div class=\"chat_message_thumb\" role=\"presentation\">" +
                            "<div class='chat_message_thumb_circle' style='background-color:" + color_code + "'>" +
                                first_letter +
                            "</div>" +
                        "</div>" +
                        "<div class=\"chat_message_meta\">" +
                            "<span class=\"chat_message_meta_name\">" +
                                name +
                            "</span>" +
                            "<span class=\"chat_message_meta_timestamp\">" +
                                time +
                            "</span>" +
                        "</div>" +
                        first_message_html +
                    "</div>";

		return html;
	}

	function new_chat_message(chat_message, msg_id, is_owner, extra_classes)
	{
		if (is_owner)
		{
			extra_classes += ' chat_message_owner';
		}

		var html = "<div id=\"" + msg_id + "\"class=\"chat_message " + extra_classes + "\">" +
                        "<div class=\"chat_message_body\">" +
                            chat_message +
                        "</div>" +
                    "</div>";

		return html;
	}

	//Update an old message
	socket.on('update_message', function(data)
	{
		$("#" + data.msg_id + " .chat_message_body").html(data.msg)
		scroll_down_chat();
	});
	//Delete an old message
	socket.on('delete_message', function(data)
	{
		$("#" + data.msg_id).remove()
		is_owner_of_last_msg = false
	});

	//chatlog
	socket.on('chatlog', function(data)
	{
		for (var i = 0; i < data.length; i++)
		{
			add_message(data[i]);
		}
		scroll_down_chat();
		is_owner_of_last_msg = false;
		last_message_id = null;
	});


	function add_server_message(msg)
	{
		var html =    "<div class=\"server_message\">" +
                         "<div class=\"chat_message_body\">" +
                             msg +
                         "</div>" +
			         "</div>";

		$chat_body.append(html);

		scroll_down_chat();
		is_owner_of_last_msg = false;
	}

	//name_changed
	socket.on('name_changed', function(data)
	{
		add_server_message(data.msg);

	});

	//SENDING
	$chat_form.submit(function(event)
	{
		event.preventDefault();

		if ($chat_input.val().length === 0)
			return false;

		if (!is_authed)
		{
			add_server_message('You are not connected');
			return false;
		}


		var temp_id = Math.random().toString(36).substr(2, 10);

		socket.emit('chat_message',
		{
			'msg': $chat_input.val(),
			'temp_id': temp_id
		});

		//If no ack in 5 seconds display failed.
		//if the ack arrives later callback will still function and clear the error
		var chat_message_timer = setTimeout(function()
		{
			var $temp_id = $('#' + temp_id);
			if ($temp_id.length > 0)
			{
				$temp_id.addClass('chat_message_failed');
			}
		}, 5000);

		//Make the message client side
		var output;
		//https://github.com/bryanwoods/autolink-js/blob/master/autolink.js
		var url_pattern = /(^|[\s\n]|<[A-Za-z]*\/?>)((?:https?|ftp):\/\/[\-A-Z0-9+\u0026\u2019@#\/%?=()~_|!:,.;]*[\-A-Z0-9+\u0026@#\/%=~()_|])/gi;

		var msg = escapeHtml($chat_input.val());
		msg = msg.replace(url_pattern, "$1<a href='$2' target='_blank'>$2</a>");

		if (is_owner_of_last_msg === true)
		{
			
			output = new_chat_message(msg, temp_id, true, 'chat_message_unconfirmed');
			$('#' + last_message_id).after(output);
		}
		else
		{
			output = new_message_group(user_name, new Date().getTime(), msg, temp_id, true, ' chat_message_unconfirmed');
			$chat_body.append(output);
		}
		scroll_down_chat();

		last_message_id = temp_id;
		is_owner_of_last_msg = true;

		$chat_input.val('');
		return false;
	});

	socket.on('chat_message_resp', function(data)
	{
		console.log("chat_message_resp: ", data)
		if (data.OK === true)
		{
			//set the new id
			var $acked_msg = $('#' + data.temp_id);
			$acked_msg.removeClass('chat_message_unconfirmed');
			$acked_msg.removeClass('chat_message_failed');
			$acked_msg.attr('id', data.msg_id);

			//update last message id
			if (last_message_id == data.temp_id)
			{
				last_message_id = data.msg_id;
			}
		}
		else
		{
			var $bad_msg = $('#' + data.temp_id);
			$bad_msg.addClass('chat_message_failed');
		}
	});
	

	//NAME SELECTION

	var $chat_name_form = $('#chat_name_form');
	var $chat_name_input = $('#chat_name_input');
	var $popup_group = $('.chat_defocus, .chat_name_selection');


	$chat_input.on('focus', function()
	{
		if (user_name === null)
		{
			show_name_selector();
		}
	});
	$('#name_btn').on('click', function()
	{
		show_name_selector();
		return false;
	});

	function show_name_selector()
	{
		$popup_group.removeClass('hide');
		setTimeout(function()
		{
			$popup_group.removeClass('faded');
			$chat_name_input.focus();
		}, 5);
	}

	//Close button
	$('#chat_name_selection_close, .chat_defocus').on('click', function()
	{
		$popup_group.addClass('hide faded');
		$chat_name_input.blur();
		return false;
	});


	//send name request on submit
	$chat_name_form.on('submit', function()
	{
		event.preventDefault();

		if ($chat_name_input.val().length === 0)
			return false;

		if (!is_authed)
			return false;

		var requested_name = $chat_name_input.val();

		socket.emit('name_request',
		{
			'name_request': requested_name
		}, function(data)
		{
			console.log("data: "+ data);
			if (data.OK === true)
			{
				//Name accepted
				user_name = data.name;
				localStorage.setItem('user_name', user_name);
				$popup_group.addClass('hide faded');
				$chat_input.focus();
				$name_btn.html(user_name);
				is_owner_of_last_msg = false;

			}
			else
			{
				$('.chat_name_error_box').html(data.DESC);
			}
		});


	});


	//Quality of life stuff

	//Enter to submit
	$chat_input.keypress(function(e)
	{
		if (e.which == 13 && e.shiftKey === false)
		{
			$chat_form.submit();
			e.preventDefault();
			return false;
		}
	});

	function scroll_down_chat()
	{
		$chat_body.scrollTop($chat_body[0].scrollHeight);
		setTimeout(function(){
			if($chat_body.scrollTop() + $chat_body.innerHeight() + 1 < $chat_body[0].scrollHeight) {
	            //console.log("REFIRE: " + ($chat_body.scrollTop() + $chat_body.innerHeight()) + " < " + $chat_body[0].scrollHeight)
				scroll_down_chat()
	        }
		}, 100);
	}
	scroll_down_chat();


	//Color mapping
	var color_map = {
		'A': 'rgb(0, 0, 180)',
		'B': 'rgb(175, 13, 102)',
		'C': 'rgb(146,248,70)',
		'D': 'rgb(255, 200, 47)',
		'E': 'rgb(255,118,0)',
		'F': 'rgb(185,185,185)',
		'G': 'rgb(235,235,222)',
		'H': 'rgb(100,100,100)',
		'I': 'rgb(55,100,50)',
		'J': 'rgb(55,19,112)',
		'K': 'rgb(150,50,50)',
		'L': 'rgb(202,62,94)',
		'M': 'rgb(205,145,63)',
		'N': 'rgb(12,75,100)',
		'O': 'rgb(255,0,0)',
		'P': 'rgb(175,155,50)',
		'Q': 'rgb(0,0,0)',
		'R': 'rgb(37,70,25)',
		'S': 'rgb(121,33,135)',
		'T': 'rgb(83,140,208)',
		'U': 'rgb(0,154,37)',
		'V': 'rgb(178,220,205)',
		'W': 'rgb(255,152,213)',
		'X': 'rgb(0,0,74)',
		'Y': 'rgb(175,200,74)',
		'Z': 'rgb(63,25,12)'
	};
}());
 
 //Moustache.js
 var entityMap = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

function escapeHtml (string) {
  return String(string).replace(/[&<>"'`=]/g, function (s) {
    return entityMap[s];
  });
}